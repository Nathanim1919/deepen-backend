// src/services/pdfProcessor.ts

import { generateSlug } from "../../common/utils/slugify";
import {
  calculateReadingTime,
  Capture,
  countWords,
} from "../../common/models/Capture";
import { downloadPdf } from "../../common/utils/pdfUtils";
import { uploadToR2 } from "../../common/utils/r2Upload";
import { extractTextFromPdf } from "../../common/utils/extractTextFromPdf";
import { hashContent } from "../../common/utils/hashing";
import { withRetry } from "../../common/utils/withRetry";
import { connectMongo } from "../../common/config/database";
import { aiProcessing } from "../../trigger/aiProcessing";
import {
  embeddingProcessing,
  EmbeddingTaskType,
} from "../../trigger/embeddingProcessing";

// Ensure MongoDB is connected before doing any DB operations
// The connection will be awaited inside the processor function to guarantee
// the DB is ready before any operations are attempted.

/**
 * Process a PDF capture:
 * 1. Download the PDF
 * 2. Upload to Azure Blob Storage
 * 3. Extract text content
 * 4. Compute metadata (slug, word count, hash, reading time)
 * 5. Update the MongoDB capture document
 * 6. Enqueue AI summarization task
 *
 * @param captureId - The MongoDB document ID for the capture
 * @param url - The original PDF URL
 */
export async function processPdfCapture(captureId: string, url: string) {
  const traceId = `[PDF Processor] [${captureId}]`;

  // Ensure MongoDB connection is established before performing any DB operations.
  // Awaiting here prevents Mongoose buffering timeouts when the service starts
  // and the connection is not yet fully ready.
  await connectMongo();

  try {
    const capture = await Capture.findByIdAndUpdate(
      captureId,
      {
        processingStatus: "processing",
        "metadata.capturedAt": new Date(),
      },
      { new: true },
    );

    if (!capture) throw new Error("Capture not found");

    const pdfData = await withRetry(() => downloadPdf(url), 3, 2000);
    console.log(
      `${traceId} Downloaded PDF: ${pdfData.fileName} (${pdfData.size} bytes)`,
    );
    console.log(`${traceId} PDF Text Extracted: ${pdfData}`);

    const [blobUrl, rawText] = await Promise.all([
      await uploadToR2(pdfData),
      extractTextFromPdf(pdfData.buffer),
    ]);

    const cleanText = rawText.replace(/\s{2,}/g, " ").trim();
    if (!cleanText || cleanText.length < 100) {
      throw new Error("Text content too short or invalid");
    }

    const title = pdfData.fileName.replace(/\.pdf$/i, "") || "Untitled";
    const metadata = {
      type: "document",
      isPdf: true,
      wordCount: countWords(cleanText),
      readingTime: calculateReadingTime(cleanText),
      capturedAt: new Date(),
    };

    await Capture.findByIdAndUpdate(captureId, {
      title,
      slug: generateSlug(title),
      blobUrl,
      content: { clean: cleanText },
      contentHash: hashContent(cleanText),
      metadata,
      processingStatus: "ready",
    });

    await aiProcessing.trigger({
      captureId,
      userId: capture.owner?.toString() || "",
    });

    await embeddingProcessing.trigger({
      captureId,
      userId: capture.owner?.toString() || "",
      taskType: EmbeddingTaskType.INDEX,
    });

    return { success: true, captureId, slug: generateSlug(title), blobUrl };
  } catch (err) {
    console.error(
      `${traceId} ❌ Error: ${err instanceof Error ? err.message : err}`,
    );
    await Capture.findByIdAndUpdate(captureId, {
      processingStatus: "error",
    });
    return {
      success: false,
      captureId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
