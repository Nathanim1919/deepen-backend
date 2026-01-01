import pdf from "pdf-parse/lib/pdf-parse.js";

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdf(buffer);
    return data.text?.trim() || "";
  } catch (err) {
    console.error("Failed to extract text from PDF:", err);
    return "";
  }
}
