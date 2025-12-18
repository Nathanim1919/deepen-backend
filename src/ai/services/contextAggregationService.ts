import { Types } from 'mongoose';
import { Capture } from '../../common/models/Capture';
import { Collection } from '../../common/models/Collection';
import { searchSimilar } from './vectorStore';
import { logger } from '../../common/utils/logger';

export interface ContextQuery {
  userId: string;
  contextType: 'all' | 'collection' | 'bookmarks' | 'specific' | 'mixed';
  contextItems?: {
    type: 'capture' | 'collection';
    id: Types.ObjectId;
  }[];
  query: string;
  filters?: {
    dateRange?: { start: Date; end: Date };
    contentTypes?: string[];
    limit?: number;
  };
}

export interface AggregatedContext {
  sources: {
    id: Types.ObjectId;
    type: 'capture' | 'collection';
    title: string;
    relevanceScore: number;
  }[];
  retrievedChunks: Array<{
    text: string;
    sourceId: Types.ObjectId;
    sourceType: 'capture' | 'collection';
    similarity: number;
  }>;
  totalSources: number;
}

/**
 * Builds context from various sources based on the context type
 */
export class ContextAggregationService {

  /**
   * Main method to aggregate context for brain chat
   */
  static async aggregateContext(query: ContextQuery): Promise<AggregatedContext> {
    try {
      const { userId, contextType, contextItems, query: searchQuery } = query;

      let captureIds: Types.ObjectId[] = [];
      let sources: AggregatedContext['sources'] = [];

      // Build capture IDs based on context type
      switch (contextType) {
        case 'all':
          captureIds = await this.getAllUserCaptures(userId, query.filters);
          break;
        case 'collection':
          captureIds = await this.getCollectionCaptures(userId, contextItems || []);
          break;
        case 'bookmarks':
          captureIds = await this.getBookmarkedCaptures(userId, query.filters);
          break;
        case 'specific':
          captureIds = await this.getSpecificCaptures(userId, contextItems || []);
          break;
        case 'mixed':
          captureIds = await this.getMixedCaptures(userId, contextItems || []);
          break;
      }

      // Build sources metadata
      sources = await this.buildSourcesMetadata(captureIds, contextType);

      // Perform vector search across the selected captures
      const retrievedChunks = await this.performMultiSourceSearch(
        searchQuery,
        userId,
        captureIds,
        query.filters?.limit || 20
      );

      return {
        sources,
        retrievedChunks,
        totalSources: captureIds.length
      };

    } catch (error) {
      logger.error('Context aggregation failed', { error, userId: query.userId });
      throw error;
    }
  }

  /**
   * Get all captures for a user with optional filters
   */
  private static async getAllUserCaptures(
    userId: string,
    filters?: ContextQuery['filters']
  ): Promise<Types.ObjectId[]> {
    const query: any = {
      owner: new Types.ObjectId(userId),
      status: 'active'
    };

    if (filters?.dateRange) {
      query.createdAt = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }

    if (filters?.contentTypes?.length) {
      query.format = { $in: filters.contentTypes };
    }

    const captures = await Capture.find(query)
      .select('_id')
      .limit(1000) // Reasonable limit for "all" context
      .lean();

    return captures.map(c => c._id);
  }

  /**
   * Get captures from specific collections
   */
  private static async getCollectionCaptures(
    userId: string,
    contextItems: ContextQuery['contextItems']
  ): Promise<Types.ObjectId[]> {
    const collectionIds = contextItems
      .filter(item => item.type === 'collection')
      .map(item => item.id);

    const collections = await Collection.find({
      _id: { $in: collectionIds },
      user: new Types.ObjectId(userId)
    }).select('captures').lean();

    const captureIds: Types.ObjectId[] = [];
    collections.forEach(collection => {
      if (collection.captures) {
        captureIds.push(...collection.captures);
      }
    });

    return [...new Set(captureIds)]; // Remove duplicates
  }

  /**
   * Get bookmarked captures
   */
  private static async getBookmarkedCaptures(
    userId: string,
    filters?: ContextQuery['filters']
  ): Promise<Types.ObjectId[]> {
    const query: any = {
      owner: new Types.ObjectId(userId),
      bookmarked: true,
      status: 'active'
    };

    if (filters?.dateRange) {
      query.createdAt = {
        $gte: filters.dateRange.start,
        $lte: filters.dateRange.end
      };
    }

    const captures = await Capture.find(query)
      .select('_id')
      .limit(500)
      .lean();

    return captures.map(c => c._id);
  }

  /**
   * Get specific captures by ID
   */
  private static async getSpecificCaptures(
    userId: string,
    contextItems: ContextQuery['contextItems']
  ): Promise<Types.ObjectId[]> {
    const captureIds = contextItems
      .filter(item => item.type === 'capture')
      .map(item => item.id);

    // Verify ownership
    const captures = await Capture.find({
      _id: { $in: captureIds },
      owner: new Types.ObjectId(userId),
      status: 'active'
    }).select('_id').lean();

    return captures.map(c => c._id);
  }

  /**
   * Handle mixed context types (collections + specific captures)
   */
  private static async getMixedCaptures(
    userId: string,
    contextItems: ContextQuery['contextItems']
  ): Promise<Types.ObjectId[]> {
    const [collectionCaptures, specificCaptures] = await Promise.all([
      this.getCollectionCaptures(userId, contextItems),
      this.getSpecificCaptures(userId, contextItems)
    ]);

    return [...new Set([...collectionCaptures, ...specificCaptures])];
  }

  /**
   * Build metadata for sources
   */
  private static async buildSourcesMetadata(
    captureIds: Types.ObjectId[],
    contextType: string
  ): Promise<AggregatedContext['sources']> {
    if (captureIds.length === 0) return [];

    const captures = await Capture.find({
      _id: { $in: captureIds }
    }).select('_id title url format').lean();

    return captures.map(capture => ({
      id: capture._id,
      type: 'capture' as const,
      title: capture.title || capture.url || 'Untitled',
      relevanceScore: contextType === 'all' ? 0.5 : 1.0 // Higher score for explicitly selected items
    }));
  }

  /**
   * Perform vector search across multiple captures
   */
  private static async performMultiSourceSearch(
    query: string,
    userId: string,
    captureIds: Types.ObjectId[],
    limit: number
  ): Promise<AggregatedContext['retrievedChunks']> {
    if (captureIds.length === 0) {
      return [];
    }

    try {
      // Use existing vector search but with multiple document IDs
      // This assumes the vectorStore.searchSimilar can handle multiple documentIds
      const searchResults = await searchSimilar({
        query,
        userId,
        documentIds: captureIds.map(id => id.toString()), // Convert to strings if needed
        limit,
        userApiKey: '' // Will need to be passed from caller
      });

      return searchResults.map((result: any) => ({
        text: result.payload?.text || '',
        sourceId: new Types.ObjectId(result.documentId),
        sourceType: 'capture' as const,
        similarity: result.score || 0
      }));

    } catch (error) {
      logger.error('Vector search failed in context aggregation', { error, userId });
      return [];
    }
  }
}
