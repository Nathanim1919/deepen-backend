import { Request, Response } from "express";
import { Capture } from "../../common/models/Capture";
import { logger } from "../../common/utils/logger";
import {
  ErrorResponse,
  SuccessResponse,
} from "../../common/utils/responseHandlers";
import {
  // ConversationRequest,
  processContent,
  // processConversation,
  processConversationStream,
  validateRequest,
} from "../../ai/services/aiService";
import { UserService } from "../services/user.service";
import { listModels } from "../../common/config/openRouter";

// Constants
const SERVICE_NAME = "AIController";
// Increased timeout to 60 seconds for longer AI responses/streaming
const REQUEST_TIMEOUT_MS = 60000; // 60 seconds

/**
 * @class AIController
 * @description Handles all AI-related operations including summarization and conversations
 */
export class AIController {
  /**
   * @method generateSummary
   * @description Generates AI summary for a capture
   */
  static async generateSummary(req: Request, res: Response): Promise<void> {
    try {
      const { captureId } = req.body;
      const { user } = req;

      // Validate input
      if (!captureId) {
        ErrorResponse({
          res,
          statusCode: 400,
          message: "Capture ID is required",
          errorCode: "MISSING_CAPTURE_ID",
        });
        return;
      }

      logger.info(`${SERVICE_NAME}:generateSummary`, { captureId });

      // Find the capture by ID
      const capture = await Capture.findById(captureId);
      if (!capture) {
        ErrorResponse({
          res,
          statusCode: 404,
          message: "Capture not found",
          errorCode: "CAPTURE_NOT_FOUND",
        });
        return;
      }

      const result = await processContent(
        capture.content.clean || "",
        user.id,
        capture.ai.summary || "",
      );

      if (result.success && result.data) {
        capture.ai.summary = result.data.summary || "";
        await capture.save();

        logger.info(`${SERVICE_NAME}:generateSummary:success`, {
          captureId,
          summaryLength: result.data.summary?.length,
        });
      } else {
        return ErrorResponse({
          res,
          statusCode: 500,
          message: "Failed to generate summary",
          error: result.error,
          errorCode: "SUMMARY_GENERATION_FAILED",
        });
      }

      SuccessResponse({
        res,
        statusCode: 200,
        data: {
          summary: result?.data?.summary,
          captureId,
        },
        message: "AI summary generated successfully",
      });
    } catch (error) {
      logger.error(`${SERVICE_NAME}:generateSummary:error`, error);
      ErrorResponse({
        res,
        statusCode: 500,
        message: "Failed to generate AI summary",
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "AI_SUMMARY_FAILED",
      });
    }
  }

  static async listModels(_req: Request, res: Response): Promise<void> {
    const models = await listModels();
    SuccessResponse({
      res,
      statusCode: 200,
      data: models,
      message: "Models listed successfully",
    });
  }

  /**
   * @method converse
   * @description Handles AI conversation with context from a capture
   */
  static async chat(req: Request, res: Response): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort("Request timeout"),
      REQUEST_TIMEOUT_MS,
    );
    const { user } = req;

    // Set headers for Server-Sent Events (SSE) immediately
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Cache-Control", "no-cache");
    res.flushHeaders(); // Send headers to the client

    try {
      const { isValid, error } = validateRequest(req);
      if (!isValid) {
        // We can't send a normal JSON error if headers are flushed, so we send an error event.
        res.write(
          `data: ${JSON.stringify({ error: error || "Invalid request", code: "INVALID_REQUEST" })}\n\n`,
        );
        res.end();
        return;
      }

      const { captureId, messages, model } = req.body;

      logger.info(`${SERVICE_NAME}:converse:stream:start`, {
        captureId,
        model,
      });

      const documentSummary = await Capture.findById(captureId)
        .select("ai.summary")
        .lean()
        .exec();
      const apiKey = await UserService.getGeminiApiKey(user.id);

      if (!apiKey) {
        res.write(
          `data: ${JSON.stringify({ error: "API key is required", code: "API_KEY_REQUIRED" })}\n\n`,
        );
        res.end();
        return;
      }

      logger.info(`${SERVICE_NAME}:converse:stream:start`, {
        captureId,
        model,
      });

      // Get the stream from our service function
      const stream = processConversationStream(
        user,
        apiKey,
        documentSummary?.ai.summary || "",
        captureId,
        messages,
        model,
        controller.signal,
      );

      // Write each chunk from the stream to the response
      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }

      // Send a final message to indicate the stream is successfully done
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (error) {
      const err = error as Error;
      logger.error(`${SERVICE_NAME}:converse:stream:error`, {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });

      // Send an error event to the client before closing.
      // Include error details so the client can surface a clearer message.
      const errorCode =
        err.name === "AbortError"
          ? "REQUEST_TIMEOUT"
          : "AI_CONVERSATION_FAILED";
      const errorMessage =
        err.name === "AbortError"
          ? "Request timed out"
          : "AI conversation failed";

      res.write(
        `data: ${JSON.stringify({
          error: errorMessage,
          code: errorCode,
          details: err.message,
        })}\n\n`,
      );
    } finally {
      clearTimeout(timeout);
      res.end(); // Always close the connection
    }
  }
}
