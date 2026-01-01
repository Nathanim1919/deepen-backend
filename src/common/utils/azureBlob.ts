// src/utils/azureBlob.ts
import { BlobServiceClient } from "@azure/storage-blob";
import dotenv from "dotenv";
dotenv.config();

const AZURE_STORAGE_CONNECTION_STRING =
  process.env.AZURE_STORAGE_CONNECTION_STRING!;
const containerName = "pdfs"; // your container

const blobServiceClient = BlobServiceClient.fromConnectionString(
  AZURE_STORAGE_CONNECTION_STRING
);

export const uploadPdfToBlob = async (
  buffer: Buffer,
  fileName: string
): Promise<string> => {
  const containerClient = blobServiceClient.getContainerClient(containerName);

  const blockBlobClient = containerClient.getBlockBlobClient(fileName);

  const uploadBlobResponse = await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: {
      blobContentType: "application/pdf",
    },
  });

  if (uploadBlobResponse.errorCode) {
    throw new Error(
      `Azure Blob Upload Failed: ${uploadBlobResponse.errorCode}`
    );
  }

  return blockBlobClient.url; // This is the full accessible URL of the uploaded file
};
