import { Document, Types } from "mongoose";

export interface IContentHighlight {
  text: string;
  annotation?: string;
  position: [number, number]; // start and end offsets
  createdAt?: Date;
  createdBy?: Types.ObjectId;
}

export interface IContentAttachment {
  type: "pdf" | "image" | "video" | "spreadsheet" | "audio";
  url: string;
  thumbnail?: string;
  size: number; // in bytes
  name?: string;
  metadata?: Record<string, any>; // dynamic depending on file type
}

export interface ICaptureReference {
  type: "link" | "citation" | "embed" | "related";
  url?: string;
  title?: string;
  capture?: Types.ObjectId;
  position?: [number, number]; // optional for inline references
}

export interface IHeadings {
  level: number; // 1–6
  text: string;
}

export interface ICapture extends Omit<Document, "collection"> {
  // ---- Core Identity ----
  owner?: Types.ObjectId;
  workspace?: Types.ObjectId;
  bookmarked?: boolean;
  collection?: Types.ObjectId;
  url: string;
  blobUrl?: string;
  isDuplicate?: boolean;
  duplicateOf?: Types.ObjectId;
  canonicalUrl?: string;
  title?: string;
  slug?: string;
  headings?: IHeadings[];
  contentHash?: string;
  conversation?: Types.ObjectId;

  // ---- Format ----
  format:
    | "webpage"
    | "pdf"
    | "video"
    | "image"
    | "audio"
    | "document"
    | "other";

  // ---- Content Storage ----
  content: {
    raw?: string;
    clean?: string;
    markdown?: string;
    highlights: IContentHighlight[];
    attachments: IContentAttachment[];
  };

  // ---- Enhanced Metadata ----
  metadata: {
    description: string;
    favicon?: string;
    siteName?: string;
    language?: string;
    keywords: string[];
    isPdf: boolean;
    publishedAt?: Date;
    capturedAt?: Date;
    author?: string;
    type: "article" | "document" | "product" | "discussion" | "code" | "other";
    wordCount: number;
    readingTime: number;
  };

  // ---- AI/ML Features ----
  ai: {
    summary?: string;
    embeddings?: number[];
  };

  // ---- Graph Relationships ----
  references: ICaptureReference[];

  // ---- System ----
  status: "active" | "archived" | "deleted";
  privacy: "private" | "workspace" | "public";
  version: number;

  processingStatus: "pending" | "processing" | "complete" | "error";
  processingStatusMessage: string;

  source: {
    ip?: string;
    userAgent?: string;
    extensionVersion: string;
    method: "extension" | "upload" | "api" | "import";
  };

  // ---- Timestamps ----
  createdAt: Date;
  updatedAt: Date;
}
