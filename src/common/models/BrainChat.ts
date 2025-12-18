import mongoose, { Schema, Types } from "mongoose";

export interface IBrainChatSession extends mongoose.Document {
  _id: string;
  userId: Types.ObjectId;
  title?: string;
  contextType: 'all' | 'collection' | 'bookmarks' | 'specific' | 'mixed';
  contextItems: {
    type: 'capture' | 'collection';
    id: Types.ObjectId;
  }[];
  messages: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    contextUsed?: {
      sources: Types.ObjectId[]; // IDs of captures/collections used for this response
      retrievedChunks: number;
    };
  }[];
  isActive: boolean;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBrainChatContext {
  type: 'capture' | 'collection' | 'all';
  id?: Types.ObjectId;
  filters?: {
    dateRange?: { start: Date; end: Date };
    contentTypes?: string[];
    tags?: string[];
  };
}

const BrainChatMessageSchema = new Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  contextUsed: {
    sources: [{ type: Schema.Types.ObjectId, refPath: 'contextItems.type' }],
    retrievedChunks: { type: Number, default: 0 }
  }
}, { _id: false });

const BrainChatContextItemSchema = new Schema({
  type: { type: String, enum: ['capture', 'collection'], required: true },
  id: { type: Schema.Types.ObjectId, required: true, refPath: 'type' }
}, { _id: false });

const BrainChatSessionSchema = new Schema<IBrainChatSession>({
  userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, maxlength: 200 },
  contextType: {
    type: String,
    enum: ['all', 'collection', 'bookmarks', 'specific', 'mixed'],
    required: true
  },
  contextItems: [BrainChatContextItemSchema],
  messages: [BrainChatMessageSchema],
  isActive: { type: Boolean, default: true, index: true },
  lastActivity: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

// Indexes for efficient queries
BrainChatSessionSchema.index({ userId: 1, isActive: 1, lastActivity: -1 });
BrainChatSessionSchema.index({ userId: 1, createdAt: -1 });

// Auto-update lastActivity
BrainChatSessionSchema.pre('save', function(next) {
  this.lastActivity = new Date();
  next();
});

export const BrainChatSession = mongoose.model<IBrainChatSession>('BrainChatSession', BrainChatSessionSchema);
