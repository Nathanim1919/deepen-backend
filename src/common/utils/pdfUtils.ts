import axios from "axios";
import path from "path";

export interface DownloadedPdf {
  buffer: Buffer;
  size: number;
  fileName: string;
  contentType: string;
}

/**
 * Downloads a PDF from a given URL and returns its buffer and metadata.
 */
export async function downloadPdf(url: string): Promise<DownloadedPdf> {
    console.log(`[PDF Download] Starting download from ${url}`);
  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LinkMeldBot/1.0; +https://linkmeld.com/bot)",
        Accept: "application/pdf",
      },
    });


    const contentType = response.headers["content-type"] || "";
    const contentDisposition = response.headers["content-disposition"] || "";

    if (
      !contentType.includes("application/pdf") &&
      !url.toLowerCase().endsWith(".pdf")
    ) {
      throw new Error("URL does not return a valid PDF file");
    }

    // Extract filename from headers or URL
    let fileName = "document.pdf";
    const match = contentDisposition.match(/filename="?(.+?)"?$/i);
    if (match) {
      fileName = match[1];
    } else {
      const parsed = new URL(url);
      fileName = path.basename(parsed.pathname) || fileName;
    }

    return {
      buffer: Buffer.from(response.data),
      size: response.data.byteLength,
      fileName,
      contentType,
    };
  } catch (err) {
    console.error(`[PDF Download] Error downloading from ${url}`, err);
    throw new Error("Failed to download PDF");
  }
}
