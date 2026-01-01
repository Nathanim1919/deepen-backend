import mongoose, { Schema, Types } from "mongoose";
import { hashContent } from "../utils/hashing";
import { generateSlug } from "../utils/slugify";
import { normalizeUrl } from "../utils/urls";
import {
  ICapture,
  ICaptureReference,
  IContentAttachment,
  IContentHighlight,
} from "../types/capureTypes";

// Sub-schemas
const HighlightSchema = new Schema<IContentHighlight>(
  {
    text: { type: String, required: true },
    annotation: String,
    position: { type: [Number], required: true },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const AttachmentSchema = new Schema<IContentAttachment>(
  {
    type: {
      type: String,
      required: true,
      enum: ["pdf", "image", "video", "spreadsheet", "audio"],
    },
    url: { type: String, required: true },
    thumbnail: String,
    size: { type: Number, required: true },
    name: String,
    metadata: Object,
  },
  { _id: false }
);

const ReferenceSchema = new Schema<ICaptureReference>(
  {
    type: {
      type: String,
      required: true,
      enum: ["link", "citation", "embed", "related"],
    },
    url: String,
    title: String,
    capture: { type: Schema.Types.ObjectId, ref: "Capture" },
    position: [Number],
  },
  { _id: false }
);

// Main schema
const CaptureSchema = new Schema<ICapture>(
  {
    owner: { type: Types.ObjectId, ref: "User", required: true, index: true },
    workspace: { type: Types.ObjectId, ref: "Workspace", index: true },
    bookmarked: { type: Boolean, default: false },
    collection: { type: Types.ObjectId, ref: "Collection", index: true },
    url: {
      type: String,
      required: true,
      validate: {
        validator: isValidUrl,
        message: "Invalid URL format",
      },
      index: true,
    },
    canonicalUrl: {
      type: String,
      validate: {
        validator: isValidUrl,
        message: "Invalid URL format",
      },
    },
    title: {
      type: String,
      required: function () {
        return this.format === "webpage";
      },
      trim: true,
      maxlength: 500,
    },
    headings: [
      {
        level: { type: Number, required: true },
        text: { type: String, required: true },
      },
    ],
    slug: { type: String, index: true },
    contentHash: {
      type: String,
      required: function () {
        return this.format === "webpage";
      },
      index: true,
    },

    format: {
      type: String,
      enum: ["webpage", "pdf", "video", "image", "audio", "document", "other"],
      default: "webpage",
      index: true,
    },

    ai: {
      summary: { type: String, default: "" },
      embeddings: { type: [Number], default: [] },
    },
    blobUrl: { type: String },
    isDuplicate: { type: Boolean, default: false },
    duplicateOf: { type: Types.ObjectId, ref: "Capture", default: null },
    conversation: { type: Schema.Types.ObjectId, ref: "Conversation" },
    content: {
      raw: { type: String, select: false },
      clean: {
        type: String,
        required: function () {
          return this.format === "webpage";
        },
      },
      markdown: { type: String },
      highlights: { type: [HighlightSchema], default: [] },
      attachments: { type: [AttachmentSchema], default: [] },
    },

    metadata: {
      description: { type: String, default: "" },
      favicon: String,
      siteName: String,
      language: {
        type: String,
        default: "english",
      },
      keywords: { type: [String], default: [] },
      isPdf: { type: Boolean, default: false },
      publishedAt: Date,
      capturedAt: { type: Date, default: Date.now },
      type: {
        type: String,
        enum: ["article", "document", "product", "discussion", "code", "other"],
        default: "article",
      },
      wordCount: { type: Number, default: 0 },
      readingTime: { type: Number, default: 0 },
    },

    references: { type: [ReferenceSchema], default: [] },

    status: {
      type: String,
      enum: ["active", "archived", "deleted"],
      default: "active",
      index: true,
    },
    privacy: {
      type: String,
      enum: ["private", "workspace", "public"],
      default: "private",
      index: true,
    },
    version: { type: Number, default: 1 },

    processingStatus: {
      type: String,
      enum: ["pending", "processing", "complete", "error"],
      default: "pending",
    },
    processingStatusMessage: {
      type: String,
    },
    source: {
      ip: String,
      userAgent: String,
      extensionVersion: { type: String, required: true },
      method: {
        type: String,
        enum: ["extension", "upload", "api", "import"],
        default: "extension",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

CaptureSchema.index(
  {
    slug: 1,
    owner: 1,
    format: 1,
  },
  {
    unique: true,
    name: "unique_slug_per_owner_format",
  }
);

// Indexes
CaptureSchema.index({ owner: 1, status: 1, createdAt: -1 });

CaptureSchema.index(
  { title: "text", "content.clean": "text" },
  {
    name: "content_search",
    weights: {
      title: 10,
      "content.clean": 3,
    },
  }
);

CaptureSchema.index({ contentHash: 1, owner: 1 }, { unique: true });

// Middleware
CaptureSchema.pre<ICapture>("save", async function (next) {
  // Generate slug if missing
  if (!this.slug) {
    const fallbackTitle = this.title?.trim() || "Untitled";

    if (fallbackTitle.toLowerCase() === "untitled") {
      const base = this.url || new Date().toISOString();
      this.slug = `${generateSlug("untitled")}-${hashContent(base).slice(
        0,
        8
      )}`;
    } else {
      this.slug = generateSlug(fallbackTitle);
    }
  }

  // Normalize URL if modified
  if (this.isModified("url")) {
    this.canonicalUrl = this.canonicalUrl || (await normalizeUrl(this.url));
  }

  const cleanContent = this.content?.clean?.trim() ?? "";

  if ((this.isModified("content.clean") || this.isNew) && !this.contentHash) {
    if (cleanContent.length > 0) {
      this.contentHash = hashContent(cleanContent);
      this.metadata.wordCount = countWords(cleanContent);
      this.metadata.readingTime = calculateReadingTime(cleanContent);
    } else if (this.metadata?.isPdf && this.url) {
      this.contentHash = hashContent(this.url);
      this.metadata.wordCount = 0;
      this.metadata.readingTime = 0;
    } else {
      this.contentHash = "";
      this.metadata.wordCount = 0;
      this.metadata.readingTime = 0;
    }
  }

  // Versioning
  if (this.isNew) {
    this.version = 1;
  } else {
    this.version += 1;
  }

  next();
});

// Helpers
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function countWords(text: string): number {
  return text?.split(/\s+/).filter((w) => w.length > 0).length;
}

export function calculateReadingTime(text: string): number {
  const wpm = 200;
  return Math.ceil(countWords(text) / wpm);
}

export const Capture = mongoose.model<ICapture>("Capture", CaptureSchema);
