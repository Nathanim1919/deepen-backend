import { User } from "better-auth/types";
import { ContextAggregationService, AggregatedContext } from "./contextAggregationService";
import { buildConversationPrompt } from "./aiService";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../../common/utils/logger";
import { BrainChatConversation, IBrainChatConversation } from "../../common/models/BrainChat";
import { Types } from "mongoose";
import { openRouter, sendMessage } from "../../common/config/openRouter";
import { v4 as uuidv4 } from "uuid";
import { Message } from "@openrouter/sdk/esm/models";

export interface BrainChatContext {
  brain: {
    enabled: boolean;
  };
  bookmarks: {
    enabled: boolean;
  };
  captures: {
    ids: string[];
  };
  collections: {
    ids: string[];
  };
}

export interface BrainChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  status: "sent" | "received";
}

export interface BrainChatRequest {
  sessionId?: string;
  userId: string;
  contextType?: string;
  contextItems?: any[];
  message: string;
  conversationHistory?: BrainChatMessage[];
  filters?: any;
}

export interface BrainChatStartRequest {
  id: string;
  title: string;
  createdAt: Date;
  context: BrainChatContext;
  messages: BrainChatMessage[];
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
        ? await BrainChatConversation.findById(sessionId)
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
  // static async* processBrainChatStream(
  //   request: BrainChatRequest,
  //   apiKey: string,
  //   signal?: AbortSignal
  // ): AsyncIterable<string> {
  //   try {
  //     const {
  //       sessionId,
  //       userId,
  //       contextType,
  //       contextItems,
  //       message,
  //       conversationHistory = [],
  //       filters
  //     } = request;

  //     // Get or create session
  //     let session = sessionId
  //       ? await BrainChatConversation.findById(sessionId)
  //       : null;

  //     if (!session) {
  //       session = await this.createNewSession(request);
  //     }

  //     // Aggregate context
  //     const aggregatedContext = await ContextAggregationService.aggregateContext({
  //       userId,
  //       contextType,
  //       contextItems,
  //       query: message,
  //       filters
  //     });

  //     // Build context string
  //     const contextString = this.buildContextString(aggregatedContext);

  //     // Build messages for AI
  //     const messages = this.buildConversationMessages(conversationHistory, message);

  //     // Build prompt
  //     const prompt = this.buildBrainChatPrompt(
  //       messages,
  //       contextString,
  //       aggregatedContext.sources.length
  //     );

  //     // Generate streaming response
  //     const result = await this.model.generateContentStream(prompt);

  //     let fullResponse = '';
  //     for await (const chunk of result.stream) {
  //       if (signal?.aborted) break;

  //       const chunkText = chunk.text();
  //       if (chunkText) {
  //         fullResponse += chunkText;
  //         yield chunkText;
  //       }
  //     }

  //     // Save conversation after streaming completes
  //     await this.updateSessionWithMessages(session, message, fullResponse, aggregatedContext);

  //   } catch (error) {
  //     logger.error('Brain chat streaming failed', { error, userId: request.userId });
  //     throw error;
  //   }
  // }

  /**
   * Create a new brain chat session with streaming
   * @param userId
   * @param request
   * @param signal
   * @returns Object with conversation and stream
   */
  static async startConversationStreaming(userId: string, request: BrainChatStartRequest, signal?: AbortSignal) {
    try {
      if (request.messages.length === 0) {
        throw new Error('Messages are required to start a conversation');
      }

      const conversation = new BrainChatConversation({
        userId: new Types.ObjectId(userId),
        title: "new conversation",
        createdAt: request.createdAt,
        context: request.context,
        messages: request.messages
      });

      const messages: Message[] = [
        {
          role: "system",
          content: "You are a helpful assistant that can help with questions about the user's brain chat conversation.",
        },
        ...request.messages,
      ];

      const stream = await sendMessage(
        "gpt-4o-mini",
        messages,
        signal
      );

      return { conversation, stream };
    } catch (error) {
      logger.error('Failed to start conversation streaming', { error, userId });
      throw error;
    }
  }

  /**
   * Create a new brain chat session
   * @param userId
   * @param request
   * @returns The created brain chat conversation
   */
  static async startConversation(userId: string, request: BrainChatStartRequest) {
    try {
     
      if (request.messages.length === 0) {
        throw new Error('Messages are required to start a conversation');
      }


      const conversation = new BrainChatConversation({
        userId: new Types.ObjectId(userId),
        title: "new conversation",
        createdAt: request.createdAt,
        context: request.context,
        messages: request.messages
      });

      const askModel = await openRouter.chat.send({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that can help with questions about the user's brain chat conversation.",
          },
          ...request.messages,
        ],
      });


      // Add the AI response to the conversation messages
      const aiResponse = askModel.choices[0]?.message?.content;
      if (aiResponse && typeof aiResponse === 'string') {
        conversation.messages.push({
          id: uuidv4() as string,
          role: 'assistant' as const,
          content: aiResponse,
          timestamp: new Date(),
          status: 'received' as const
        } as BrainChatMessage);
      }

      await conversation.save();
      return conversation;
    } catch (error) {
      logger.error('Failed to start conversation', { error, userId });
      throw error;
    }
  }

  /**
   * Send a message to a brain chat conversation
   * @param conversationId 
   * @param userId 
   * @param message 
   */
  static async sendMessage(
    conversationId: string,
    userId: string,
    content: string,
    signal?: AbortSignal
  ) {
    const conversation = await BrainChatConversation.findById(conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
  
    const messages: Message[] = [
      {
        role: "system",
        content: "You are a helpful assistant that can help with questions about the user's brain chat conversation.",
      },
      ...conversation.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content },
    ];
  
    const stream = await sendMessage(
      "gpt-4o-mini",
      messages,
      signal
    );
  
    // 🚨 DO NOT consume the stream here
    return { conversation, stream };
  }
  


  private static async buildConversationContext(conversation: IBrainChatConversation): Promise<string> {
    return `
    You are a helpful assistant that can help with questions about the user's brain chat conversation.
    The conversation history is as follows:
    ${conversation.messages.map(message => `${message.role.toUpperCase()}: ${message.content}`).join('\n\n')}
    `;
  }

  /**
   * List user's brain chat conversations
   * @param userId 
   * @returns List of brain chat conversations
   */
  static async conversationsList(userId: string): Promise<IBrainChatConversation[]> {
    return BrainChatConversation.find({ userId: new Types.ObjectId(userId) }).select('title createdAt lastActivity messages').sort({ lastActivity: -1 }).lean();
  }

  /**
   * Get a brain chat conversation by id and user id
   * @param conversationId 
   * @param userId 
   */
  static async getConversation(conversationId: string, userId: string): Promise<IBrainChatConversation | null> {
    return BrainChatConversation.findOne({ _id: new Types.ObjectId(conversationId), userId: new Types.ObjectId(userId) }).select('title createdAt lastActivity messages').lean();
  }

  /**
   * Delete a brain chat conversation by id and user id
   * @param conversationId 
   * @param userId 
   */
  static async deleteConversation(conversationId: string, userId: string): Promise<void> {
    await BrainChatConversation.deleteOne({ _id: new Types.ObjectId(conversationId), userId: new Types.ObjectId(userId) });
  }


  /**
   * Generate a title for the chat session based on the first message
   */
  static generateSessionTitle(firstMessage: string): string {
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
        id: uuidv4(),
        role: 'user',
        content: newMessage,
        status: 'sent',
        timestamp: new Date(),
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
    return BrainChatConversation.findOne({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId)
    });
  }

  /**
   * List user's brain chat sessions
   */
  static async listUserSessions(userId: string, limit = 20) {
    return BrainChatConversation.find({
      userId: new Types.ObjectId(userId)
    })
      .select('title contextType createdAt lastActivity messages')
      .sort({ lastActivity: -1 })
      .limit(limit)
      .lean();
  }
}
