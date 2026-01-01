// scripts/seedIndexes.ts
import mongoose from "mongoose";
import { Capture } from "../common/models/Capture";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI!;

async function createIndexes() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("📦 Connected to MongoDB");

    const collection = Capture.collection;

    // Drop old index: slug_1 (if exists)
    try {
      await collection.dropIndex("slug_1");
      console.log("🗑️ Dropped old slug_1 index");
    } catch (err: any) {
      if (err.codeName !== "IndexNotFound") {
        throw err;
      } else {
        console.log("ℹ️ slug_1 index not found (already dropped)");
      }
    }

    // Drop old index: searchTokens_text (if exists)
    try {
      await collection.dropIndex("searchTokens_text");
      console.log("🗑️ Dropped old searchTokens_text index");
    } catch (err: any) {
      if (err.codeName !== "IndexNotFound") {
        throw err;
      } else {
        console.log("ℹ️ searchTokens_text index not found (already dropped)");
      }
    }

    // Drop old index: unique_slug_per_owner_format (if exists)
    try {
      await collection.dropIndex("unique_slug_per_owner_format");
      console.log("🗑️ Dropped old unique_slug_per_owner_format index");
    } catch (err: any) {
      if (err.codeName !== "IndexNotFound") {
        throw err;
      } else {
        console.log("ℹ️ unique_slug_per_owner_format index not found (already dropped)");
      }
    }

    // ✅ Create new unique index on contentHash + owner + format (sparse for PDFs without content yet)
    await collection.createIndex(
      { owner: 1, contentHash: 1, format: 1 },
      {
        unique: true,
        sparse: true, // Allow documents without contentHash (e.g. PDFs waiting to be processed)
        name: "unique_content_per_owner_format",
      }
    );
    console.log("✅ Created unique index: unique_content_per_owner_format");

  // Drop old slug_1 if it conflicts with new name
      try {
        await collection.dropIndex("slug_1");
        console.log("🗑️ Dropped old slug_1 index");
      } catch (err: any) {
        if (err.codeName !== "IndexNotFound") {
          console.log("⚠️ Could not drop slug_1, might not exist or already renamed");
        }
      }

      // Then safely create non-unique slug index
      try {
        await collection.createIndex({ slug: 1 }, { name: "slug_index" });
        console.log("🔎 Created non-unique slug index");
      } catch (err: any) {
        if (err.code === 85) {
          console.log("ℹ️ Slug index already exists with same key pattern");
        } else {
          throw err;
        }
      }


    // ✅ Create full-text index on title and content.clean
    await collection.createIndex(
      {
        title: "text",
        "content.clean": "text",
      },
      {
        name: "content_search",
        weights: {
          title: 10,
          "content.clean": 3,
        },
      }
    );
    console.log("🔤 Created full-text index: content_search");

    console.log("🎉 All indexes created successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error creating indexes:", err);
    process.exit(1);
  }
}

createIndexes();
