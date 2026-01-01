import { task } from "@trigger.dev/sdk/v3";
import { deleteTextEmbedding, indexText } from "../ai/services/vectorStore";
import { UserService } from "../api/services/user.service";
import { Capture } from "../common/models/Capture";
import { connectMongo } from "../common/config/database";

export enum EmbeddingTaskType {
  INDEX = "INDEX",
  DELETE = "DELETE",
}

export const embeddingProcessing = task({
  id: "embedding-processing",
  retry: {
    maxAttempts: 3,
    factor: 1.8,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
    randomize: true,
  },
  run: async (payload: {
    captureId: string;
    userId: string;
    taskType: EmbeddingTaskType;
  }) => {
    await connectMongo();
    const { captureId, userId, taskType } = payload;
    const traceId = `[Embedding Processing] [${captureId}] [${taskType}]`;
    const apiKey = await UserService.getGeminiApiKey(userId);

    if (!apiKey) {
      console.error(`${traceId} ❌ API key not found`);
      return;
    }

    console.log(`${traceId} Starting embedding processing...`);

    try {
      const capture = await Capture.findById(captureId);
      if (!capture) {
        console.error(`${traceId} ❌ Capture not found`);
        return;
      }

      switch (taskType) {
        case EmbeddingTaskType.INDEX:
          console.log(`${traceId} [INDEX] Starting embedding...`);
          try {
            const text = capture.content?.clean?.trim();
            if (!text || text.length < 50) {
              console.error(`${traceId} ❌ Text too short for embedding`);
              return;
            }

            await indexText({
              text,
              docId: captureId,
              userId,
              userApiKey: apiKey,
            });
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            console.error(
              `${traceId} [INDEX] ❌ Error indexing embedding: ${errorMsg}`,
            );
            return;
          }
          break;
        case EmbeddingTaskType.DELETE:
          console.log(`${traceId} [DELETE] Starting deletion...`);
          try {
            await deleteTextEmbedding({
              docId: captureId,
              userId,
            });
          } catch (error) {
            const errorMsg =
              error instanceof Error ? error.message : String(error);
            console.error(
              `${traceId} [DELETE] ❌ Error deleting embedding: ${errorMsg}`,
            );
            return;
          }
          console.log(`${traceId} [DELETE] Deletion completed`);
          break;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`${traceId} ❌ Error processing embedding: ${errorMsg}`);
      return;
    }
    console.log(`${traceId} ✅ Embedding processing completed`);
  },
});
