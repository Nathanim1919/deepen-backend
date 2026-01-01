import { AIResponse } from "../types";
import { Request } from "express";
// import { validate as uuidValidate } from 'uuid';
import { rateLimit } from "express-rate-limit";
import { User } from "better-auth/types";
import { UserService } from "../../api/services/user.service";
import { withRetry } from "../../common/utils/withRetry";
import { searchSimilar } from "./vectorStore";
import { logger } from "../../common/utils/logger";
// Import the SDK at the top of your file
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Prompt } from "../prompts/summaryPrompts";

// Type definitions
export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  usageMetadata?: {
    totalTokenCount?: number;
  };
}

const GEMINI_GENERATION_CONFIG = {
  temperature: 0.7,
  topP: 0.9,
  maxOutputTokens: 1000,
};

// const GEMINI_SAFETY_SETTINGS = [
//   { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
//   { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
//   { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
//   { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
// ];

// Constants and configuration
const DEFAULT_MODEL = "gemini-2.0-flash";
const MAX_CONVERSATION_LENGTH = 30; // Max messages in conversation
const MAX_INPUT_LENGTH = 10000; // Characters
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100;

export interface ConversationRequest {
  captureId: string;
  messages: Message[];
  model?: string;
}

// interface ProcessedResponse {
//   message: string;
//   tokensUsed?: number;
//   modelUsed?: string;
// }

const GEMINI_CONFIG = {
  SUMMARY_MODEL: "gemini-pro", // This is fine for the conceptual name
  EMBEDDING_MODEL: "embedding-001", // Corrected for the endpoint path
  MAX_RETRIES: 2,
  REQUEST_TIMEOUT: 30000, // Increased timeout for testing ETIMEDOUT
  FREE_TIER_LIMIT: 60, // requests per minute
};

// Main function to process content
export const processContent = async (
  content: string,
  userId: string,
  existingSummary?: string,
): Promise<AIResponse> => {
  try {
    // Process content and generate summary
    const apiKey = await UserService.getGeminiApiKey(userId);

    if (!apiKey) {
      return {
        success: false,
        error: "API key is required for AI operations",
      };
    }

    if (!content || content.trim().length < 100) {
      return {
        success: false,
        error: "Content must be at least 100 characters long.",
      };
    }

    const cleanText = removeBoilerplate(content);

    // Use Promise.allSettled to allow one promise to fail without stopping the other
    // and provide more granular error handling.
    const summaryResult = await generateSummary(
      cleanText,
      existingSummary,
      apiKey,
    );

    return {
      success: true,
      data: {
        summary: summaryResult,
      },
    };
  } catch (error) {
    return handleGeminiError(error);
  }
};

// Generate summary using Gemini API
export const generateSummary = async (
  text: string,
  existingSummary: string = "", // This is now crucial
  apiKey: string,
): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    GEMINI_CONFIG.REQUEST_TIMEOUT,
  );

  try {
    const response = await withRetry(
      () =>
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: Prompt.generateSummary(text, existingSummary),
                    },
                  ],
                },
              ],
            }),
            signal: controller.signal,
          },
        ),
      GEMINI_CONFIG.MAX_RETRIES,
      2000,
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const raw = await response.text();
      console.error("Gemini summary API error:", response.status, raw);
      throw new Error(`Summary API Error ${response.status}: ${raw}`);
    }

    try {
      const data = (await response.json()) as GeminiResponse;
      const summaryText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!summaryText) {
        console.warn("No summary text found in Gemini response:", data);
        return "";
      }
      return summaryText;
    } catch (jsonError: any) {
      const raw = await response.text();
      console.error(
        "Failed to parse JSON for summary:",
        jsonError,
        "Raw:",
        raw,
      );
      throw new Error(`Invalid JSON response from Gemini summary API: ${raw}`);
    }
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
};

// Utility to clean content (HTML → plain text)
const removeBoilerplate = (html: string): string => {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

// General error handler
const handleGeminiError = (error: any): AIResponse => {
  console.error("AI Processing Error:", error);

  if (error.name === "AbortError") {
    return {
      success: false,
      error: "Request timed out",
    };
  }

  // Check for the specific error message from the 404
  if (
    error.message &&
    error.message.includes("404") &&
    error.message.includes("models/gemini-pro is not found")
  ) {
    return {
      success: false,
      error:
        "Gemini Pro model not found or accessible. Please verify your API key, project configuration, and model availability via ListModels API.",
    };
  }

  if (error.message && error.message.includes("429")) {
    // Assuming the original error will contain 429 status
    return {
      success: false,
      error: "API rate limit exceeded",
      retryAfter: 60000,
    };
  }
  // Generic error message if specific conditions are not met
  return {
    success: false,
    error: `AI processing failed: ${error.message || "Unknown error"}.`,
  };
};

// Rate limiter middleware
export const conversationRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again later.",
});

export const validateRequest = (
  req: Request,
): { isValid: boolean; error?: string } => {
  if (!req.body) return { isValid: false, error: "Request body is missing" };

  const { captureId, messages } = req.body as ConversationRequest;
  // || !uuidValidate(captureId
  if (!captureId) {
    return { isValid: false, error: "Invalid or missing captureId" };
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return { isValid: false, error: "Messages must be a non-empty array" };
  }

  if (messages.length > MAX_CONVERSATION_LENGTH) {
    return {
      isValid: false,
      error: `Conversation too long. Max ${MAX_CONVERSATION_LENGTH} messages allowed.`,
    };
  }

  for (const msg of messages) {
    if (!msg.role || !["user", "assistant", "system"].includes(msg.role)) {
      return { isValid: false, error: "Invalid message role" };
    }
    if (
      !msg.content ||
      typeof msg.content !== "string" ||
      msg.content.length > MAX_INPUT_LENGTH
    ) {
      return { isValid: false, error: "Invalid message content" };
    }
  }

  return { isValid: true };
};

export const buildConversationPrompt = (
  userName: string,
  documentSummary: string,
  messages: Message[],
  retrievedContext: string,
): string => {
  return Prompt.conversationPrompt(
    userName,
    documentSummary,
    messages,
    retrievedContext,
  );
};

// This function now becomes an async generator
/**
 * Processes a conversation by performing retrieval-augmented generation (RAG)
 * and streaming the response from the Gemini API.
 *
 * @returns An AsyncIterable<string> that yields text chunks of the AI's response.
 */
export async function* processConversationStream(
  user: User,
  apiKey: string,
  documentSummary: string,
  documentId: string,
  messages: Message[],
  model: string = DEFAULT_MODEL,
  signal?: AbortSignal,
): AsyncIterable<string> {
  try {
    // 1. Perform retrieval based on the user's current question
    const lastUserMessage =
      messages.filter((m) => m.role === "user").slice(-1)[0]?.content || "";
    const cleanUserMessage = lastUserMessage.trim().slice(0, 1000);

    const similarChunks = await searchSimilar({
      query: cleanUserMessage,
      userId: user.id,
      documentId: documentId,
      userApiKey: apiKey,
    });

    let retrievedContext = "";
    if (similarChunks.length > 0) {
      retrievedContext = similarChunks
        .map((chunk: any) => chunk.payload?.text)
        .filter(Boolean)
        .join("\n---\n");
    } else {
      retrievedContext =
        "No specific relevant information found in this document for your query.";
    }

    logger.info("INFORMATION RETRIEVED FOR STREAM", {
      userId: user.id,
      documentId: documentId,
    });

    // 2. Build the final prompt
    const prompt = buildConversationPrompt(
      user.name,
      documentSummary,
      messages,
      retrievedContext,
    );

    // 3. Instantiate the SDK and call the streaming endpoint
    const genAI = new GoogleGenerativeAI(apiKey);
    const generativeModel = genAI.getGenerativeModel({
      model: model,
      // safetySettings: GEMINI_SAFETY_SETTINGS,
      generationConfig: GEMINI_GENERATION_CONFIG,
    });

    // NOTE: Do NOT pass the AbortSignal into the SDK request object here.
    // Some SDK implementations serialize unknown fields into the JSON payload,
    // which can cause the remote API to reject the request (e.g. \"Unknown name 'signal'\").
    // Instead, rely on the controller-level AbortSignal and the internal abort
    // checks performed while iterating the returned stream below. We intentionally
    // avoid forwarding `signal` into the request object to prevent it from being
    // included in the JSON payload sent to the API.
    const streamingResult = await generativeModel.generateContentStream({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    // 4. Yield each chunk of text as it arrives
    for await (const chunk of streamingResult.stream) {
      // AbortSignal check - if signalled, throw an error with the name "AbortError"
      // so upstream handlers can distinguish timeout/abort cases.
      if (signal?.aborted) {
        const abortErr = Object.assign(new Error("Request aborted"), {
          name: "AbortError",
        });
        throw abortErr;
      }
      const chunkText = chunk.text();
      if (chunkText) {
        yield chunkText; // 'yield' sends this piece back to the controller
      }
    }
  } catch (error) {
    logger.error("Conversation stream processing failed", {
      userId: user.id,
      documentId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Re-throw the error so the controller can catch and handle it
    throw error;
  }
}
