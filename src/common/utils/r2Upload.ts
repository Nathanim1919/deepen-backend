// utils/r2Upload.ts
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

// Internal SDK client (for uploading)
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, // internal endpoint
  credentials: {
    accessKeyId: process.env.CF_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

type MulterLikeFile = {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
};

type DownloadedFile = {
  fileName: string;
  buffer: Buffer;
  contentType: string;
};

type UploadFile = MulterLikeFile | DownloadedFile;

const isMulterFile = (file: UploadFile): file is MulterLikeFile =>
  "originalname" in file && "mimetype" in file;

export const uploadToR2 = async (file: UploadFile) => {
  const originalName = isMulterFile(file) ? file.originalname : file.fileName;
  const contentType = isMulterFile(file) ? file.mimetype : file.contentType;

  const fileExt = path.extname(originalName);
  const key = `videos/${randomUUID()}${fileExt}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: contentType,
  });

  await r2.send(command);
  console.log(`${process.env.R2_PUBLIC_DOMAIN}/${key}`);

  // ✅ Return the public URL using your R2.dev domain
  return {
    url: `${process.env.R2_PUBLIC_DOMAIN}/${key}`, // e.g. pub-xxxxxxx.r2.dev
    key,
  };
};
