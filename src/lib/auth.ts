import dotenv from "dotenv";
dotenv.config();

import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

// Use this instead of Mongoose for the adapter connection
// In your auth.ts
const mongo = new MongoClient(process.env.MONGO_URI! as string);
mongo.connect(); // Explicitly connect

const dbName = "deepen";
const db = mongo.db(dbName);

export const auth = betterAuth({
  database: mongodbAdapter(db),
  trustedOrigins: [
    "https://deepen.live", // Added trusted origin
    "https://www.deepen.live", // Fixed syntax error
    "http://localhost:5173", // Replace with your frontend's origin
    "https://deepen-api.onrender.com", // Added trusted origin
    "https://deepen-ten.vercel.app",
  ],
  advanced: {
    // THIS IS THE FIX
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true, // Required for SameSite="none"
    },
  },
  secret: process.env.BETTER_AUTH_SECRET as string,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
});
