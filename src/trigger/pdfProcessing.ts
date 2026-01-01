import { task } from "@trigger.dev/sdk/v3";
import { processPdfCapture } from "../api/services/pdfProcessor";

export const pdfProcessing = task({
  id: "pdf-processing",
  retry: {
    maxAttempts: 3,
    factor: 1.8,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
    randomize: true,
  },
  run: async (payload: { captureId: string; url: string }) => {
    const { captureId, url } = payload;
    const traceId = `[PDF Processing] [${captureId}] [${url}]`;
    console.log(`${traceId} Starting PDF processing...`);

    try {
      await processPdfCapture(captureId, url);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`${traceId} ❌ Error processing PDF: ${errorMsg}`);
      return;
    }
  },
});
