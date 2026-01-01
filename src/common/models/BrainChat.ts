import mongoose, { Schema, Types } from "mongoose";

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
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  status: 'sent' | 'received';
}

export interface IBrainChatConversation extends mongoose.Document {
  _id: string;
  userId: Types.ObjectId;
  title?: string;
  context: BrainChatContext;
  messages: BrainChatMessage[];
  isActive: boolean;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}


// BrainChatMessageSchema is the schema for a message in a brain chat conversation
const BrainChatMessageSchema = new Schema<BrainChatMessage>({
  id: { type: String, required: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['sent', 'received'], required: true },
}, { _id: false });


const BrainChatConversationSchema = new Schema<IBrainChatConversation>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, maxlength: 200 },
  context: {
    brain: {
      enabled: { type: Boolean, default: false }
    },
    bookmarks: {
      enabled: { type: Boolean, default: false }
    },
    captures: {
      ids: { type: [String], default: [] }
    },
    collections: {
      ids: { type: [String], default: [] }
    }
  },
  messages: [BrainChatMessageSchema],
  isActive: { type: Boolean, default: true },
  lastActivity: { type: Date, default: Date.now },
}, {
  timestamps: true
});

// Indexes for efficient queries
BrainChatConversationSchema.index({ userId: 1, isActive: 1, lastActivity: -1 });
BrainChatConversationSchema.index({ userId: 1, createdAt: -1 });

// Auto-update lastActivity
BrainChatConversationSchema.pre('save', function (next) {
  this.lastActivity = new Date();
  next();
});

export const BrainChatConversation = mongoose.model<IBrainChatConversation>('BrainChatConversation', BrainChatConversationSchema);