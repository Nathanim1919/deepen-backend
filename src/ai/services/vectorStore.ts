import { TaskType } from "@google/generative-ai";
import { qdrant } from "../clients/qdrant";
import { chunkText } from "../../common/utils/chunkText";
import { generateGeminiEmbeddingsWithFetch } from "../../common/utils/embedding";
import { logger } from "../../common/utils/logger";
import { QdrantClient } from "@qdrant/js-client-rest";
import { withRetry } from "../../common/utils/withRetry";
import { v4 as uuidv4 } from "uuid";
const VECTOR_SIZE = 3072; // Gemini 1.5 embedding size; // Default size for Gemini embeddings

/**
 * Indexes the provided text by chunking it and generating embeddings for each chunk.
 * @param text The text content to index.
 * @param docId The unique identifier for the document.
 * @param userId The ID of the user who owns the document.
 * @param userApiKey The API key for the user's Gemini account.
 */

export async function indexText({
  text,
  docId,
  userId,
  userApiKey,
}: {
  text: string;
  docId: string;
  userId: string;
  userApiKey: string;
}) {
  const chunks = chunkText(text);

  interface QdrantPointPayload {
    [key: string]: string | number;
    text: string;
    user_id: string;
    doc_id: string;
    chunk_index: number;
    created_at: string;
  }

  interface QdrantPoint {
    id: string;
    vector: number[];
    payload: QdrantPointPayload;
  }

  const points: QdrantPoint[] = [];

  logger.info(`Indexing document ${docId} with ${chunks.length} chunks`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await generateGeminiEmbeddingsWithFetch(
      chunk,
      userApiKey,
      "RETRIEVAL_DOCUMENT" as TaskType.RETRIEVAL_DOCUMENT,
      3,
      2000,
    );

    if (embedding !== null) {
      // Validate embedding
      if (!Array.isArray(embedding) || embedding.length !== VECTOR_SIZE) {
        logger.error(
          `Invalid embedding for chunk ${i} of doc ${docId}: Expected ${VECTOR_SIZE} dimensions, got ${embedding.length}`,
        );
        continue;
      }

      points.push({
        id: uuidv4(), // Generate a unique ID for the point
        vector: embedding,
        payload: {
          text: chunk,
          user_id: userId,
          doc_id: docId,
          chunk_index: i,
          created_at: new Date().toISOString(),
        },
      });

      logger.debug("First point to upsert:", JSON.stringify(points[0]));
      logger.debug(`POINTS: ${points}`);
    } else {
      logger.warn(
        `Failed to generate embedding for chunk ${i} of doc ${docId}`,
      );
    }
  }

  if (points.length === 0) {
    logger.warn(`No valid points to upsert for doc ${docId}`);
    return;
  }

  // Ensure collection exists
  await ensureCollection(qdrant, "documents");

  // Upsert with retry
  await withRetry(
    async () => {
      try {
        logger.debug(
          `Upserting ${points.length} points to documents collection`,
        );
        await qdrant
          .upsert("documents", { points })
          .then((res) => {
            logger.info(`THE RESPONSE IS: ${res}`);
            logger.info(
              `Successfully upserted ${points.length} points for doc ${docId}`,
            );
          })
          .catch((err) => {
            logger.error(`ERROR OCCURED: ${err}`);
          });
        // logger.info(`Upsert result: ${JSON.stringify(result)}`);
      } catch (error) {
        logger.error(`Upsert failed for doc ${docId}:`, {
          message: error.message,
          stack: error.stack,
          status: error.status,
          response: error.response
            ? JSON.stringify(error.response.data, null, 2)
            : null,
          cause: error.cause,
          points: points.length,
        });
        throw error;
      }
    },
    3,
    2000,
  );
}

async function ensureCollection(client: QdrantClient, collectionName: string) {
  try {
    await client.getCollection(collectionName);
    logger.debug(`Collection ${collectionName} exists`);
  } catch (error) {
    if (error.status === 404) {
      logger.info(`Creating collection ${collectionName}`);
      await client.createCollection(collectionName, {
        vectors: {
          size: VECTOR_SIZE,
          distance: "Cosine",
        },
      });
      logger.info(`Created collection ${collectionName}`);
    } else {
      logger.error(`Failed to verify collection ${collectionName}:`, error);
      throw error;
    }
  }
}

/**
 * Deletes a text embedding from the vector store.
 * @param param0 The parameters for deleting the embedding.
 * @param docId The unique identifier for the document.
 * @param userId The ID of the user who owns the document.
 * @returns A promise that resolves when the deletion is complete.
 */
export async function deleteTextEmbedding({
  docId,
  userId,
}: {
  docId: string;
  userId: string;
}) {
  logger.info(`Deleting embedding for docId=${docId}, userId=${userId}`);

  // Ensure collection exists
  await ensureCollection(qdrant, "documents");

  // Delete points by filter
  const result = await qdrant.delete("documents", {
    filter: {
      must: [
        { key: "user_id", match: { value: userId } },
        { key: "doc_id", match: { value: docId } },
      ],
    },
  });

  logger.info(`Deleted embedding for docId=${docId}, userId=${userId}`, {
    status: result.status,
    operationId: result.operation_id,
  });
}

/**
 * Searches for similar documents based on the provided query.
 * @param query The search query string.
 * @param userId The ID of the user making the request.
 * @param userApiKey The API key for the user's Gemini account.
 * @returns A promise that resolves to the search results.
 */

export async function searchSimilar({
  query,
  userId,
  documentId,
  userApiKey,
}: {
  query: string;
  userId: string;
  documentId: string;
  userApiKey: string;
}) {
  const vector = await generateGeminiEmbeddingsWithFetch(
    query,
    userApiKey,
    "RETRIEVAL_QUERY" as TaskType.RETRIEVAL_QUERY,
    3,
    2000,
  );

  if (!vector) {
    throw new Error("Failed to generate vector for the query");
  }

  return await qdrant.search("documents", {
    vector,
    limit: 5,
    filter: {
      must: [
        { key: "user_id", match: { value: userId } },
        { key: "doc_id", match: { value: documentId } },
      ],
    },
  });
}
