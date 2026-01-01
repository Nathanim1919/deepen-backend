export interface AIPrompt {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: string;
}

export interface AIResponse {
  success: boolean;
  data?: {
    summary: string;
  };
  error?: string;
  retryAfter?: number;
}


export type ProcessingRequest = {
  userId: string;
  content: string;
  userApiKey: string;
}


export interface AIConfig {
  model: string;
  apiKey: string;
  baseUrl: string;
  maxRetries: number;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export interface ProcessedContent {
  summary: string;
  keyPoints: string[];
  sentiment: string;
  topics: string[];
  metadata: {
    wordCount: number;
    readingTime: number;
    language: string;
  };
} 