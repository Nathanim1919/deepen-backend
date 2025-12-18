import mongoose, { ConnectOptions } from "mongoose";
import { config } from "./config";

let isConnected = false;

// 1. REMOVED deprecated options (useNewUrlParser, useUnifiedTopology)
// 2. REMOVED @ts-ignore (no longer needed with valid options)
const defaultOptions: ConnectOptions = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  family: 4, // Keeps forcing IPv4 (good for localhost/WSL usually)
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function connectMongo(): Promise<typeof mongoose> {
  if (isConnected) return mongoose;

  const uri = process.env.MONGO_URI || config.mongoUri;

  if (!uri) throw new Error("MONGO_URI is not set in environment or config");

  // 3. Handle the 'collection' warning by suppressing strictQuery if needed
  mongoose.set("strictQuery", false);

  const maxRetries = Number(process.env.MONGO_CONNECT_RETRIES || 5);
  const baseDelay = 1000;

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `Connecting to MongoDB (attempt ${attempt}/${maxRetries})...`,
      );

      // 4. Wait for connection
      await mongoose.connect(uri, defaultOptions);

      isConnected = true;
      console.log("Connected to MongoDB");
      return mongoose;
    } catch (err) {
      lastError = err;
      console.error(`MongoDB connection attempt ${attempt} failed:`, err);

      if (attempt < maxRetries) {
        const wait = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Retrying MongoDB connection in ${wait}ms...`);
        await delay(wait);
      }
    }
  }

  throw new Error(
    `Failed to connect to MongoDB after ${maxRetries} attempts. Last error: ${lastError?.message || lastError}`,
  );
}

