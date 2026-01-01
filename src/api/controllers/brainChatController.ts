import { Request, Response } from "express";
import { BrainChatService } from "../../ai/services/brainChatService";
import { SuccessResponse, ErrorResponse } from "../../common/utils/responseHandlers";
import { logger } from "../../common/utils/logger";
import { v4 as uuidv4 } from "uuid";
// import { BrainChatConversation } from "../../common/models/BrainChat";

/**
 * Brain Chat Controller - Handles conversational AI across user's knowledge base
 */
export class BrainChatController {
  static async startConversation(req: Request, res: Response) {
    const controller = new AbortController();

    try {
      const { user } = req;
      const { title, createdAt, context, messages } = req.body;

      // Prepare SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const { conversation, stream } =
        await BrainChatService.startConversationStreaming(
          user.id,
          { id: user.id, title, createdAt, context, messages },
          controller.signal
        );

      let assistantText = "";

      for await (const chunk of stream) {
        if (chunk.error) {
          throw new Error(chunk.error.message);
        }

        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          assistantText += delta;

          // 🔥 stream token to client
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }

        if (chunk.usage) {
          res.write(
            `data: ${JSON.stringify({ usage: chunk.usage })}\n\n`
          );
        }
      }

      // ✅ Save assistant message AFTER stream completes
      conversation.messages.push({
        id: uuidv4() as string,
        role: "assistant",
        content: assistantText,
        timestamp: new Date(),
        status: "received",
      });

      await conversation.save();

      res.write(`data: ${JSON.stringify({ done: true, conversation })}\n\n`);
      res.end();
    } catch (error) {
      console.log("...........Error: ", error);
      logger.error("Streaming failed", { error });
      res.write(
        `data: ${JSON.stringify({ error: "Streaming failed" })}\n\n`
      );
      res.end();
    }

    // handle client disconnect
    req.on("close", () => controller.abort());
  }

  static async conversationsList(req: Request, res: Response) {
    try {
      const { user } = req;
      const conversations = await BrainChatService.conversationsList(user.id);
      logger.info('Conversations list', { conversations });
      return SuccessResponse({ res, statusCode: 200, data: conversations });
    } catch (error) {
      logger.error('Failed to get conversations list', { error });
      return ErrorResponse({ res, statusCode: 500, message: 'Failed to get conversations list' });
    }
  }

  static async getConversation(req: Request, res: Response) {
    try {
      const { user } = req;
      const { conversationId } = req.params;
      const conversation = await BrainChatService.getConversation(conversationId, user.id);
      return SuccessResponse({ res, statusCode: 200, data: conversation });
    } catch (error) {
      logger.error('Failed to get conversation', { error });
      return ErrorResponse({ res, statusCode: 500, message: 'Failed to get conversation' });
    }
  }


  static async sendMessage(req: Request, res: Response) {
    const controller = new AbortController();
  
    try {
      const { user } = req;
      const { conversationId } = req.params;
      const { message } = req.body;
  
      // Prepare SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
  
      const { conversation, stream } =
        await BrainChatService.sendMessage(
          conversationId,
          user.id,
          message,
          controller.signal
        );
  
      let assistantText = "";
  
      for await (const chunk of stream) {
        if (chunk.error) {
          throw new Error(chunk.error.message);
        }
  
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          assistantText += delta;
  
          // 🔥 stream token to client
          res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        }
  
        if (chunk.usage) {
          res.write(
            `data: ${JSON.stringify({ usage: chunk.usage })}\n\n`
          );
        }
      }
  
      // ✅ Save assistant message AFTER stream completes
      conversation.messages.push({
        id: uuidv4() as string,
        role: "assistant",
        content: assistantText,
        timestamp: new Date(),
        status: "received",
      });
  
      await conversation.save();
  
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      logger.error("Streaming failed", { error });
      res.write(
        `data: ${JSON.stringify({ error: "Streaming failed" })}\n\n`
      );
      res.end();
    }
  
    // handle client disconnect
    req.on("close", () => controller.abort());
  }
  
}
