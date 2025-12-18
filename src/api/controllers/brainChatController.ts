import { Request, Response } from "express";
import { BrainChatService, BrainChatRequest } from "../../ai/services/brainChatService";
import { SuccessResponse, ErrorResponse } from "../../common/utils/responseHandlers";
import { logger } from "../../common/utils/logger";
import { Types } from "mongoose";
import { BrainChatSession } from "../../common/models/BrainChat";

/**
 * Brain Chat Controller - Handles conversational AI across user's knowledge base
 */
export class BrainChatController {

  /**
   * Process a brain chat message
   */
  static async processMessage(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user?.id) {
        return ErrorResponse(res, "User not authenticated", 401);
      }

      const {
        sessionId,
        contextType,
        contextItems,
        message,
        stream = false,
        filters
      }: {
        sessionId?: string;
        contextType: 'all' | 'collection' | 'bookmarks' | 'specific' | 'mixed';
        contextItems?: { type: 'capture' | 'collection'; id: string }[];
        message: string;
        stream?: boolean;
        filters?: any;
      } = req.body;

      // Validate required fields
      if (!message?.trim()) {
        return ErrorResponse(res, "Message is required", 400);
      }

      if (!contextType || !['all', 'collection', 'bookmarks', 'specific', 'mixed'].includes(contextType)) {
        return ErrorResponse(res, "Valid contextType is required", 400);
      }

      // Convert string IDs to ObjectIds
      const processedContextItems = contextItems?.map(item => ({
        type: item.type,
        id: new Types.ObjectId(item.id)
      }));

      const brainChatRequest: BrainChatRequest = {
        sessionId,
        userId: user.id,
        contextType,
        contextItems: processedContextItems,
        message: message.trim(),
        filters
      };

      if (stream) {
        // Handle streaming response
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
          const streamGenerator = BrainChatService.processBrainChatStream(
            brainChatRequest,
            req.apiKey || ''
          );

          for await (const chunk of streamGenerator) {
            res.write(chunk);
          }

          res.end();
        } catch (streamError) {
          logger.error('Brain chat streaming error', { error: streamError, userId: user.id });
          if (!res.headersSent) {
            return ErrorResponse(res, "Streaming failed", 500);
          }
        }
      } else {
        // Handle regular response
        const result = await BrainChatService.processBrainChat(
          brainChatRequest,
          req.apiKey || ''
        );

        return SuccessResponse(res, {
          sessionId: result.sessionId,
          response: result.response,
          contextUsed: result.contextUsed
        });
      }

    } catch (error) {
      logger.error('Brain chat processing error', { error, userId: req.user?.id });
      return ErrorResponse(res, "Failed to process brain chat message", 500);
    }
  }

  /**
   * Get chat session history
   */
  static async getSession(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user?.id) {
        return ErrorResponse(res, "User not authenticated", 401);
      }

      const { sessionId } = req.params;

      if (!sessionId || !Types.ObjectId.isValid(sessionId)) {
        return ErrorResponse(res, "Valid session ID is required", 400);
      }

      const session = await BrainChatService.getChatSession(sessionId, user.id);

      if (!session) {
        return ErrorResponse(res, "Session not found", 404);
      }

      return SuccessResponse(res, {
        session: {
          id: session._id,
          title: session.title,
          contextType: session.contextType,
          contextItems: session.contextItems,
          messages: session.messages,
          isActive: session.isActive,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity
        }
      });

    } catch (error) {
      logger.error('Get session error', { error, userId: req.user?.id });
      return ErrorResponse(res, "Failed to retrieve session", 500);
    }
  }

  /**
   * List user's brain chat sessions
   */
  static async listSessions(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user?.id) {
        return ErrorResponse(res, "User not authenticated", 401);
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const sessions = await BrainChatService.listUserSessions(user.id, limit);

      return SuccessResponse(res, {
        sessions: sessions.map(session => ({
          id: session._id,
          title: session.title,
          contextType: session.contextType,
          messageCount: session.messages?.length || 0,
          isActive: session.isActive,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity
        }))
      });

    } catch (error) {
      logger.error('List sessions error', { error, userId: req.user?.id });
      return ErrorResponse(res, "Failed to retrieve sessions", 500);
    }
  }

  /**
   * Delete a brain chat session
   */
  static async deleteSession(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user?.id) {
        return ErrorResponse(res, "User not authenticated", 401);
      }

      const { sessionId } = req.params;

      if (!sessionId || !Types.ObjectId.isValid(sessionId)) {
        return ErrorResponse(res, "Valid session ID is required", 400);
      }

      const result = await BrainChatSession.findOneAndDelete({
        _id: new Types.ObjectId(sessionId),
        userId: new Types.ObjectId(user.id)
      });

      if (!result) {
        return ErrorResponse(res, "Session not found", 404);
      }

      return SuccessResponse(res, {
        message: "Session deleted successfully",
        sessionId
      });

    } catch (error) {
      logger.error('Delete session error', { error, userId: req.user?.id });
      return ErrorResponse(res, "Failed to delete session", 500);
    }
  }

  /**
   * Update session title
   */
  static async updateSessionTitle(req: Request, res: Response) {
    try {
      const user = req.user;
      if (!user?.id) {
        return ErrorResponse(res, "User not authenticated", 401);
      }

      const { sessionId } = req.params;
      const { title } = req.body;

      if (!sessionId || !Types.ObjectId.isValid(sessionId)) {
        return ErrorResponse(res, "Valid session ID is required", 400);
      }

      if (!title?.trim() || title.length > 200) {
        return ErrorResponse(res, "Valid title (1-200 characters) is required", 400);
      }

      const session = await BrainChatSession.findOneAndUpdate(
        {
          _id: new Types.ObjectId(sessionId),
          userId: new Types.ObjectId(user.id)
        },
        { title: title.trim() },
        { new: true }
      );

      if (!session) {
        return ErrorResponse(res, "Session not found", 404);
      }

      return SuccessResponse(res, {
        session: {
          id: session._id,
          title: session.title
        }
      });

    } catch (error) {
      logger.error('Update session title error', { error, userId: req.user?.id });
      return ErrorResponse(res, "Failed to update session title", 500);
    }
  }
}
