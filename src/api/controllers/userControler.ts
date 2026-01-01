import { Request, Response } from "express";
import { Capture } from "../../common/models/Capture";
import Collection from "../../common/models/Collection";
import UserProfile from "../../common/models/UserProfile";
import { logger } from "../../common/utils/logger";
import { IUser } from "../types/userTypes";
import {
  ErrorResponse,
  SuccessResponse,
} from "../../common/utils/responseHandlers";
import { validateApiKey } from "../../common/utils/validators";

// Constants
const SERVICE_NAME = "UserProfileService";
const GEMINI_SERVICE = "gemini";

/**
 * @class UserProfileController
 * @description Handles all user profile related operations
 */
export class UserProfileController {
  /**
   * @method resetAllData
   * @description Resets all user data including captures and collections
   */
  static async resetAllData(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as IUser;
      if (!user?.id) {
        ErrorResponse({
          res,
          statusCode: 401,
          message: "Unauthorized: Invalid user credentials",
        });
        return;
      }

      logger.info(`${SERVICE_NAME}:resetAllData`, { userId: user.id });

      // Execute in parallel for better performance
      await Promise.all([
        UserProfileController.clearUserCaptures(user.id),
        UserProfileController.clearUserCollections(user.id),
      ]);

      SuccessResponse({
        res,
        statusCode: 200,
        data: {
          message: "All user data has been successfully reset",
          resetItems: ["captures", "collections"],
        },
      });
    } catch (error) {
      logger.error(`${SERVICE_NAME}:resetAllData:error`, error);
      ErrorResponse({
        res,
        statusCode: 500,
        message: "Failed to reset user data",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * @method clearUserCaptures
   * @description Clears all captures for a user
   * @param userId - The user ID
   */
  static async clearUserCaptures(userId: string): Promise<void> {
    try {
      const result = await Capture.deleteMany({ owner: userId });
      logger.info(`${SERVICE_NAME}:clearUserCaptures`, {
        userId,
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      logger.error(`${SERVICE_NAME}:clearUserCaptures:error`, {
        userId,
        error,
      });
      throw new Error("Failed to clear user captures");
    }
  }

  /**
   * @method clearUserCollections
   * @description Clears all collections for a user
   * @param userId - The user ID
   */
  static async clearUserCollections(userId: string): Promise<void> {
    try {
      const result = await Collection.deleteMany({ user: userId });
      logger.info(`${SERVICE_NAME}:clearUserCollections`, {
        userId,
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      logger.error(`${SERVICE_NAME}:clearUserCollections:error`, {
        userId,
        error,
      });
      throw new Error("Failed to clear user collections");
    }
  }

  /**
   * @method upsertGeminiApiKey
   * @description Adds or updates a Gemini API key for the user
   */
  static async upsertGeminiApiKey(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as IUser;
      // Accept both the new field `geminiApiKey` and the legacy `apiKey` for backwards compatibility
      const { geminiApiKey, apiKey: legacyApiKey } = req.body;

      // Prefer explicit `geminiApiKey`, fall back to legacy `apiKey`
      const providedKey = geminiApiKey || legacyApiKey;

      // Input validation
      if (!user?.id) {
        ErrorResponse({
          res,
          statusCode: 401,
          message: "Unauthorized: Invalid user credentials",
        });
        return;
      }

      if (!providedKey) {
        ErrorResponse({
          res,
          statusCode: 400,
          message: "Gemini API key is required",
        });
        return;
      }

      if (!validateApiKey.gemini(providedKey)) {
        ErrorResponse({
          res,
          statusCode: 400,
          message: "Invalid Gemini API key format",
        });
        return;
      }

      logger.info(`${SERVICE_NAME}:upsertGeminiApiKey`, {
        userId: user.id,
        keyPresent: !!providedKey,
        legacyFieldUsed: !!legacyApiKey && !geminiApiKey,
      });

      // Find or create profile
      await UserProfile.findOneAndUpdate(
        { userId: user.id },
        {
          $set: { [`externalServices.${GEMINI_SERVICE}.apiKey`]: providedKey },
        },
        { upsert: true, new: true },
      );

      SuccessResponse({
        res,
        statusCode: 200,
        message: "Gemini API key has been successfully upserted",
      });
    } catch (error) {
      logger.error(`${SERVICE_NAME}:upsertGeminiApiKey:error`, error);
      ErrorResponse({
        res,
        statusCode: 500,
        message: "Failed to upsert Gemini API key",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * @method getUserProfile
   * @description Returns the user's profile information
   */
  static async getUserProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user as IUser;
      if (!user?.id) {
        ErrorResponse({
          res,
          statusCode: 401,
          message: "Unauthorized: Invalid user credentials",
        });
        return;
      }

      // Include the encrypted Gemini API key explicitly (schema uses select: false)
      const profile = await UserProfile.findOne({ userId: user.id })
        .select("+externalServices.gemini.apiKey")
        .lean()
        .exec();

      if (!profile) {
        ErrorResponse({
          res,
          statusCode: 404,
          message: "User profile not found",
        });
        return;
      }

      // Extract and mask the Gemini key; never return the raw key
      const rawKey = profile?.externalServices?.gemini?.apiKey as
        | string
        | undefined;
      const hasApiKey = !!rawKey;
      const maskedKey = hasApiKey
        ? `${rawKey.slice(0, 4)}...${rawKey.slice(-4)}`
        : undefined;

      // Remove raw key from object if present to avoid accidental leaks
      if (profile.externalServices && profile.externalServices.gemini) {
        delete profile.externalServices.gemini.apiKey;
      }

      SuccessResponse({
        res,
        statusCode: 200,
        data: {
          ...profile,
          externalServices: {
            ...profile.externalServices,
            gemini: {
              ...(profile.externalServices?.gemini || {}),
              hasApiKey,
              maskedKey,
            },
          },
        },
      });
    } catch (error) {
      logger.error(`${SERVICE_NAME}:getUserProfile:error`, error);
      ErrorResponse({
        res,
        statusCode: 500,
        message: "Failed to fetch user profile",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
