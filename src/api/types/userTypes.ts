import { Document } from "mongoose";

/**
 * Base user interface
 */
export interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
  password?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

/**
 * User profile interface
 */
export interface IUserProfile {
  userId: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  preferences?: {
    theme?: "light" | "dark";
    notifications?: {
      email?: boolean;
      push?: boolean;
    };
  };
  externalServices?: {
    gemini?: {
      apiKey?: string;
      lastUsed?: Date;
    };
    // Add other services as needed
  };
  metadata?: {
    lastLogin?: Date;
    loginCount?: number;
  };
}

/**
 * User DTO for safe data transfer
 */
export interface UserDTO {
  id: string;
  email: string;
  role: string;
  isVerified: boolean;
  profile?: Omit<IUserProfile, "externalServices" | "userId">;
  createdAt: Date;
}