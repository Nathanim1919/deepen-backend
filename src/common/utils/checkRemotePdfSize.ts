import axios from "axios";

const MAX_PDF_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Checks the size of a remote PDF using a HEAD request.
 * Returns size in bytes if valid. Throws if too large or invalid.
 */
export async function checkRemotePdfSize(url: string): Promise<{
    message: string;
    statusCode: number;
}> {
  try {
    const response = await axios.head(url, {
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LinkMeldBot/1.0; +https://deepen.live/bot)",
        Accept: "application/pdf",
      },
    });

    const contentType = response.headers["content-type"];
    const contentLength = response.headers["content-length"];

    if (!contentType?.includes("pdf") || !contentLength) {
      return {
        message: "URL does not return a valid PDF file or missing content-length header.",
        statusCode: 400,
      };
    }

    const size = parseInt(contentLength, 10);
    if (isNaN(size)) {
      return {
        message: "Invalid content-length header.",
        statusCode: 400,
      };
    }

    if (size > MAX_PDF_SIZE) {
      return {
        message: "PDF file exceeds the 5MB limit.",
        statusCode: 400,
      };
    }

    return {
      message: "PDF file is within the size limit.",
      statusCode: 200,
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Failed to validate PDF size"
    );
  }
}
