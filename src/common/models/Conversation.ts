export interface IConversation {
  _id: string;
  captureId: string;
  messages: {
    role: string;
    content: string;
    timestamp: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

import { Schema, model } from "mongoose";

const conversationSchema = new Schema<IConversation>({
  captureId: { type: String, required: true },
  messages: [
    {
      role: { type: String, required: true },
      content: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

conversationSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Add indexes for faster queries
conversationSchema.index({ captureId: 1 });

const Conversation = model<IConversation>("Conversation", conversationSchema);
export default Conversation;
