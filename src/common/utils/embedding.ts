import { TaskType } from "@google/generative-ai"; // You might need to install @google/generative-ai for this enum
import { withRetry } from "../../common/utils/withRetry";
import { logger } from "../../common/utils/logger";

// Define the structure for the nested embedding object
interface EmbeddingValue {
  values: number[];
}

// Define the overall response structure
interface EmbeddingResponse {
  embedding: EmbeddingValue;
}

/**
 * Generates embeddings for given texts using the Gemini API.
 * @param text The single string to embed.
 * @param apiKey Your Gemini API key.
 * @param taskType The task type for which the embeddings will be used (e.g., RETRIEVAL_DOCUMENT, RETRIEVAL_QUERY).
 * @param maxRetries Maximum number of retries for the API call.
 * @param initialDelay Initial delay for retries in milliseconds.
 * @returns A promise that resolves to an array of embedding vectors (number[]) or null if an error occurs.
 */
export async function generateGeminiEmbeddingsWithFetch(
  text: string,
  apiKey: string,
  taskType:
    | TaskType.RETRIEVAL_DOCUMENT
    | TaskType.RETRIEVAL_QUERY = TaskType.RETRIEVAL_DOCUMENT,
  maxRetries: number = 3,
  initialDelay: number = 2000, // 2 seconds
): Promise<number[] | null> {
  const EMBEDDING_MODEL = "gemini-embedding-001";
  const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  logger.info("Generating embeddings with Gemini API...");

  const requestBody = {
    content: {
      parts: [{ text: text }],
    },
    taskType: taskType,
  };

  const controller = new AbortController(); // For aborting fetch requests on retry/timeout

  try {
    const response = await withRetry(
      () =>
        fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }),
      maxRetries,
      initialDelay,
    );

    if (!response.ok) {
        const errorData = await response.json();
        logger.error("Gemini API error response", {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
        });
        throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = (await response.json()) as EmbeddingResponse;
    logger.debug("Embedding response data", {
      status: response.status,
      data: data,
      taskType: taskType,
    });

    // Correctly access the embedding values
    if (
      data.embedding &&
      Array.isArray(data.embedding.values) &&
      data.embedding.values.length > 0
    ) {
      logger.info("Embeddings generated successfully", {
        embeddingSize: data.embedding.values.length,
        taskType: taskType,
      });
      logger.info("Embeddings generated successfully", {
    embeddingSize: data.embedding.values.length,
    taskType: taskType,
  });
      // Return the embedding vector
      return data.embedding.values;
    } else {
      console.error("Invalid embedding response structure or empty embedding values:", data);
      return null;
    }
  } catch (error) {
    logger.error("Failed to generate embeddings after retries:", { error: (error as Error).message });
    return null;
  }
}
