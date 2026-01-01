import mongoose, { Schema } from "mongoose";

export type IUser = {
  _id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  password?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema<IUser>(
  {
    name: { type: String, required: true }, // Changed from username to name to match frontend
    email: { type: String, required: true, unique: true },
    password: { type: String }, // Changed to password
    emailVerified: {
      type: Boolean,
      default: false,
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true, // Automatically updates createdAt, updatedAt
  }
);


UserSchema.methods.getGeminiKey = function() {
  return this.externalServices.gemini.apiKey;
}

UserSchema.methods.setGeminiKey = function(apiKey: string) {
  this.externalServices.gemini.apiKey = apiKey;
}

const User = mongoose.model("User", UserSchema, "user");

export default User;
