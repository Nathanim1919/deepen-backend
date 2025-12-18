import { User } from "better-auth/types";
import { ContextAggregationService, AggregatedContext } from "./contextAggregationService";
import { buildConversationPrompt } from "./aiService";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../../common/utils/logger";
import { BrainChatSession } from "../../common/models/BrainChat";
import { Types } from "mongoose";

export interface BrainChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
}

export interface BrainChatRequest {
  sessionId?: string;
  userId: string;
  contextType: 'all' | 'collection' | 'bookmarks' | 'specific' | 'mixed';
  contextItems?: {
    type: 'capture' | 'collection';
    id: Types.ObjectId;
  }[];
  message: string;
  conversationHistory?: BrainChatMessage[];
  filters?: {
    dateRange?: { start: Date; end: Date };
    contentTypes?: string[];
  };
}

export interface BrainChatResponse {
  sessionId: string;
  response: string;
  contextUsed: {
    sources: number;
    retrievedChunks: number;
  };
}

/**
 * Brain Chat Service - Handles conversational AI across multiple knowledge sources
 */
export class BrainChatService {
  private static genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);
  private static model = this.genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 2000,
    }
  });

  /**
   * Process a brain chat request with multi-source context
   */
  static async processBrainChat(
    request: BrainChatRequest,
    apiKey: string
  ): Promise<BrainChatResponse> {
    try {
      const {
        sessionId,
        userId,
        contextType,
        contextItems,
        message,
        conversationHistory = [],
        filters
      } = request;

      // 1. Get or create session
      let session = sessionId
        ? await BrainChatSession.findById(sessionId)
        : null;

      if (!session) {
        session = await this.createNewSession(request);
      }

      // 2. Aggregate context from multiple sources
      const aggregatedContext = await ContextAggregationService.aggregateContext({
        userId,
        contextType,
        contextItems,
        query: message,
        filters
      });

      // 3. Build conversation messages
      const messages = this.buildConversationMessages(conversationHistory, message);

      // 4. Generate AI response
      const aiResponse = await this.generateBrainChatResponse(
        messages,
        aggregatedContext,
        { name: 'User' } as User // Will need to get actual user data
      );

      // 5. Save conversation to session
      await this.updateSessionWithMessages(session, message, aiResponse, aggregatedContext);

      return {
        sessionId: session._id.toString(),
        response: aiResponse,
        contextUsed: {
          sources: aggregatedContext.sources.length,
          retrievedChunks: aggregatedContext.retrievedChunks.length
        }
      };

    } catch (error) {
      logger.error('Brain chat processing failed', { error, userId: request.userId });
      throw error;
    }
  }

  /**
   * Stream brain chat response (similar to existing conversation stream)
   */
  static async* processBrainChatStream(
    request: BrainChatRequest,
    apiKey: string,
    signal?: AbortSignal
  ): AsyncIterable<string> {
    try {
      const {
        sessionId,
        userId,
        contextType,
        contextItems,
        message,
        conversationHistory = [],
        filters
      } = request;

      // Get or create session
      let session = sessionId
        ? await BrainChatSession.findById(sessionId)
        : null;

      if (!session) {
        session = await this.createNewSession(request);
      }

      // Aggregate context
      const aggregatedContext = await ContextAggregationService.aggregateContext({
        userId,
        contextType,
        contextItems,
        query: message,
        filters
      });

      // Build context string
      const contextString = this.buildContextString(aggregatedContext);

      // Build messages for AI
      const messages = this.buildConversationMessages(conversationHistory, message);

      // Build prompt
      const prompt = this.buildBrainChatPrompt(
        messages,
        contextString,
        aggregatedContext.sources.length
      );

      // Generate streaming response
      const result = await this.model.generateContentStream(prompt);

      let fullResponse = '';
      for await (const chunk of result.stream) {
        if (signal?.aborted) break;

        const chunkText = chunk.text();
        if (chunkText) {
          fullResponse += chunkText;
          yield chunkText;
        }
      }

      // Save conversation after streaming completes
      await this.updateSessionWithMessages(session, message, fullResponse, aggregatedContext);

    } catch (error) {
      logger.error('Brain chat streaming failed', { error, userId: request.userId });
      throw error;
    }
  }

  /**
   * Create a new brain chat session
   */
  private static async createNewSession(request: BrainChatRequest) {
    const session = new BrainChatSession({
      userId: new Types.ObjectId(request.userId),
      title: this.generateSessionTitle(request.message),
      contextType: request.contextType,
      contextItems: request.contextItems || [],
      messages: [],
      isActive: true
    });

    await session.save();
    return session;
  }

  /**
   * Generate a title for the chat session based on the first message
   */
  private static generateSessionTitle(firstMessage: string): string {
    const words = firstMessage.split(' ').slice(0, 5).join(' ');
    return words.length > 50 ? words.substring(0, 47) + '...' : words;
  }

  /**
   * Build conversation messages array
   */
  private static buildConversationMessages(
    history: BrainChatMessage[],
    newMessage: string
  ): BrainChatMessage[] {
    return [
      ...history,
      {
        role: 'user',
        content: newMessage,
        timestamp: new Date()
      }
    ];
  }

  /**
   * Generate AI response for brain chat
   */
  private static async generateBrainChatResponse(
    messages: BrainChatMessage[],
    aggregatedContext: AggregatedContext,
    user: User
  ): Promise<string> {
    const contextString = this.buildContextString(aggregatedContext);
    const prompt = this.buildBrainChatPrompt(messages, contextString, aggregatedContext.sources.length);

    const result = await this.model.generateContent(prompt);
    const response = result.response;
    return response.text();
  }

  /**
   * Build context string from aggregated context
   */
  private static buildContextString(aggregatedContext: AggregatedContext): string {
    if (aggregatedContext.retrievedChunks.length === 0) {
      return `No relevant information found across ${aggregatedContext.totalSources} sources.`;
    }

    const chunks = aggregatedContext.retrievedChunks
      .slice(0, 10) // Limit to top 10 most relevant chunks
      .map(chunk => `[From: ${chunk.sourceId}]\n${chunk.text}`)
      .join('\n\n---\n\n');

    return `Found ${aggregatedContext.retrievedChunks.length} relevant pieces of information from ${aggregatedContext.sources.length} sources:\n\n${chunks}`;
  }

  /**
   * Build prompt for brain chat
   */
  private static buildBrainChatPrompt(
    messages: BrainChatMessage[],
    contextString: string,
    sourceCount: number
  ): string {
    const conversationText = messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');

    return `You are an intelligent knowledge assistant that helps users explore and understand information from their personal knowledge base.

CONTEXT INFORMATION (${sourceCount} sources searched):
${contextString}

CONVERSATION HISTORY:
${conversationText}

INSTRUCTIONS:
- Use the context information provided above to answer questions accurately
- If the context doesn't contain relevant information, say so clearly
- Be conversational and helpful
- Reference specific sources when relevant
- Ask clarifying questions if the user's intent is unclear
- Maintain context from the conversation history

ASSISTANT: `;
  }

  /**
   * Update session with new messages
   */
  private static async updateSessionWithMessages(
    session: any,
    userMessage: string,
    aiResponse: string,
    aggregatedContext: AggregatedContext
  ) {
    const contextUsed = {
      sources: aggregatedContext.sources.map(s => s.id),
      retrievedChunks: aggregatedContext.retrievedChunks.length
    };

    session.messages.push(
      {
        role: 'user',
        content: userMessage,
        timestamp: new Date()
      },
      {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
        contextUsed
      }
    );

    await session.save();
  }

  /**
   * Get chat session history
   */
  static async getChatSession(sessionId: string, userId: string) {
    return BrainChatSession.findOne({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId)
    });
  }

  /**
   * List user's brain chat sessions
   */
  static async listUserSessions(userId: string, limit = 20) {
    return BrainChatSession.find({
      userId: new Types.ObjectId(userId)
    })
    .select('title contextType createdAt lastActivity messages')
    .sort({ lastActivity: -1 })
    .limit(limit)
    .lean();
  }
}
