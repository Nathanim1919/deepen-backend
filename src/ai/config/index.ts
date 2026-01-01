import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('Missing GEMINI_API_KEY');


// Configuration
export const DEFAULT_CONFIG = {
    model: 'gemini-1.5-pro',
    embeddingModel: 'text-embedding-004',
    temperature: 0.3,
    maxTokens: 1000, // Increased for articles
    maxRetries: 3,
    project: process.env.GCP_PROJECT,
    location: process.env.GCP_LOCATION,
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
};

// config.ts
const genAI = new GoogleGenerativeAI(apiKey);

export const generativeModel = genAI.getGenerativeModel({
  model: 'gemini-pro',
});
