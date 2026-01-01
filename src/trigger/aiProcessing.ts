import { task } from "@trigger.dev/sdk/v3";
import { processContent } from "../ai/services/aiService";
import { Capture } from "../common/models/Capture";
import { connectMongo } from "../common/config/database";

export const aiProcessing = task({
  id: "ai-processing",
  retry: {
    maxAttempts: 3,
    factor: 1.8,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
    randomize: true,
  },
  run: async (payload: { captureId: string; userId: string }) => {
    await connectMongo();
    const { captureId, userId } = payload;
    const traceId = `[AI Processing] [${captureId}]`;
    console.log(`${traceId} Starting AI processing...`);

    try {
      const capture = await Capture.findById(captureId);
      if (!capture) {
        console.error(`${traceId} ❌ Capture not found`);
        return;
      }

      const text = capture.content?.clean?.trim();
      if (!text || text.length < 50) {
        console.error(`${traceId} ❌ Text too short for AI processing`);
        return;
      }

      const result = await processContent(text, userId);
      const summary = result?.data?.summary?.trim();
      if (!summary || summary.length < 30) {
        console.error(`${traceId} ❌ AI summary too short or empty`);
        return;
      }

      capture.ai = { summary };
      await capture.save();

      console.log(
        `${traceId} ✅ AI summary generated: ${summary.length} characters`,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`${traceId} ❌ Error processing AI: ${errorMsg}`);
      return;
    }
  },
});
