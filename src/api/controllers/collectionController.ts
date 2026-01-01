import mongoose, { Types } from "mongoose";
import { Request, Response } from "express";
import Collection, { ICollection } from "../../common/models/Collection";
import { Capture } from "../../common/models/Capture";
import { ErrorResponse, SuccessResponse } from "../../common/utils/responseHandlers";

// Utility functions
const validateObjectId = (id: string): boolean =>
  mongoose.Types.ObjectId.isValid(id);

// Standardized response structure
// interface ApiResponse<T> {
//   data: T;
//   message?: string;
// }

export default {
  /**
   * Create a new collection
   */
  async createCollection(req: Request, res: Response): Promise<void> {
    try {
      const { name, parentCollection } = req.body;
      const { user } = req;

      // Authentication check
      if (!user) {
        return ErrorResponse({
          res,
          statusCode: 401,
          message: "User not authenticated",
        });
      }

      // Validation
      if (!name) {
        return ErrorResponse({
          res,
          statusCode: 400,
          message: "Collection name is required",
        });
      }

      if (parentCollection && !validateObjectId(parentCollection)) {
        return ErrorResponse({
          res,
          statusCode: 400,
          message: "Invalid parent collection ID",
        });
      }

      // Check for existing collection
      const existingCollection = await Collection.findOne({
        name: name.trim(),
        user: user.id,
      });

      if (existingCollection) {
        return ErrorResponse({
          res,
          statusCode: 409,
          message: "Collection with this name already exists",
        });
      }

      // Create new collection
      const collection = await Collection.create({
        user: user.id,
        name: name.trim(),
        parentCollection: parentCollection || null,
      });

      return SuccessResponse({
        res,
        statusCode: 201,
        data: collection,
        message: "Collection created successfully",
      });
    } catch (error) {
      console.error("[Collection] Create error:", error);
      return ErrorResponse({
        res,
        statusCode: 500,
        message: "Failed to create collection",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  /**
   * Get all collections for user
   */
  async getCollections(req: Request, res: Response): Promise<void> {
    try {
      const collections = await Collection.find({
        user: req.user?.id,
      }).populate("captures");

      return SuccessResponse({
        res,
        data: collections,
        message: "Collections retrieved successfully",
      });
    } catch (error) {
      console.error("[Collection] Fetch all error:", error);
      return ErrorResponse({
        res,
        statusCode: 500,
        message: "Failed to fetch collections",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  /**
   * Get collection by ID
   */
  async getCollectionById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!validateObjectId(id)) {
        return ErrorResponse({
          res,
          statusCode: 400,
          message: "Invalid collection ID",
        });
      }

      const collection = await Collection.findOne({
        _id: id,
        user: req.user?.id,
      }).populate("captures");

      if (!collection) {
        return ErrorResponse({
          res,
          statusCode: 404,
          message: "Collection not found",
        });
      }

      return SuccessResponse({
        res,
        data: collection,
        message: "Collection retrieved successfully",
      });
    } catch (error) {
      console.error("[Collection] Fetch by ID error:", error);
      return ErrorResponse({
        res,
        statusCode: 500,
        message: "Failed to fetch collection",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  /**
   * Add capture to collection
   */
  async addCaptureToCollection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { captureId } = req.body;

      // Validation
      if (!id || !captureId) {
        return ErrorResponse({
          res,
          statusCode: 400,
          message: "Collection ID and Capture ID are required",
        });
      }

      if (!validateObjectId(id) || !validateObjectId(captureId)) {
        return ErrorResponse({
          res,
          statusCode: 400,
          message: "Invalid ID format",
        });
      }

      // Check resources exist
      const [collection, capture] = await Promise.all([
        Collection.findById(id),
        Capture.findById(captureId),
      ]);

      if (!collection) {
        return ErrorResponse({
          res,
          statusCode: 404,
          message: "Collection not found",
        });
      }

      if (!capture) {
        return ErrorResponse({
          res,
          statusCode: 404,
          message: "Capture not found",
        });
      }

      // Check if capture already in collection
      if (collection.captures?.some((id) => id.equals(captureId))) {
        return ErrorResponse({
          res,
          statusCode: 409,
          message: "Capture already exists in this collection",
        });
      }

      // Check if capture already has a collection, if so, remove it from that collection
      if (capture.collection) {
        await Collection.findByIdAndUpdate(capture.collection, {
          $pull: { captures: capture._id },
        });
      }

      // Update both collection and capture
      await Promise.all([
        Collection.findByIdAndUpdate(id, {
          $addToSet: { captures: capture._id },
        }),
        Capture.findByIdAndUpdate(captureId, {
          collection: collection._id,
        }),
      ]);

      // Return the updated collection
      const updatedCollection = await Collection.findById(id).populate(
        "captures"
      );

      return SuccessResponse({
        res,
        data: updatedCollection,
        message: "Capture added to collection successfully",
      });
    } catch (error) {
      console.error("[Collection] Add capture error:", error);
      return ErrorResponse({
        res,
        statusCode: 500,
        message: "Failed to add capture to collection",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  /**
   * Remove capture from collection
   */
  async removeCaptureFromCollection(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { collectionId, captureId } = req.body;

      // Validation
      if (!collectionId || !captureId) {
        return ErrorResponse({
          res,
          statusCode: 400,
          message: "Collection ID and Capture ID are required",
        });
      }

      if (!validateObjectId(collectionId) || !validateObjectId(captureId)) {
        return ErrorResponse({
          res,
          statusCode: 400,
          message: "Invalid ID format",
        });
      }

      // Check collection exists
      const collection = await Collection.findById(collectionId);
      if (!collection) {
        return ErrorResponse({
          res,
          statusCode: 404,
          message: "Collection not found",
        });
      }

      // Check capture exists in collection
      if (!collection.captures?.includes(new Types.ObjectId(captureId))) {
        return ErrorResponse({
          res,
          statusCode: 404,
          message: "Capture not found in this collection",
        });
      }

      // Update both collection and capture
      await Promise.all([
        Collection.findByIdAndUpdate(collectionId, {
          $pull: { captures: captureId },
        }),
        Capture.findByIdAndUpdate(captureId, {
          $unset: { collection: "" },
        }),
      ]);

      // Return the updated collection
      const updatedCollection = await Collection.findById(
        collectionId
      ).populate("captures");

      return SuccessResponse({
        res,
        data: updatedCollection,
        message: "Capture removed from collection successfully",
      });
    } catch (error) {
      console.error("[Collection] Remove capture error:", error);
      return ErrorResponse({
        res,
        statusCode: 500,
        message: "Failed to remove capture from collection",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  /**
   * Delete collection
   */
  async deleteCollection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!validateObjectId(id)) {
        return ErrorResponse({
          res,
          statusCode: 400,
          message: "Invalid collection ID",
        });
      }

      // First remove collection reference from all captures
      await Capture.updateMany(
        { collection: id },
        { $unset: { collection: "" } }
      );

      const deletedCollection = await Collection.findByIdAndDelete(id);
      if (!deletedCollection) {
        return ErrorResponse({
          res,
          statusCode: 404,
          message: "Collection not found",
        });
      }

      return SuccessResponse({
        res,
        data: { id: deletedCollection._id },
        message: "Collection deleted successfully",
      });
    } catch (error) {
      console.error("[Collection] Delete error:", error);
      return ErrorResponse({
        res,
        statusCode: 500,
        message: "Failed to delete collection",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  /**
   * Update collection
   */
  async updateCollection(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, parentCollection } = req.body;

      if (!validateObjectId(id)) {
        return ErrorResponse({
          res,
          statusCode: 400,
          message: "Invalid collection ID",
        });
      }

      const updates: Partial<ICollection> = {};

      if (name) updates.name = name.trim();
      if (parentCollection) {
        if (!validateObjectId(parentCollection)) {
          return ErrorResponse({
            res,
            statusCode: 400,
            message: "Invalid parent collection ID",
          });
        }
        updates.parentCollection = parentCollection;
      }

      const updatedCollection = await Collection.findByIdAndUpdate(
        id,
        updates,
        { new: true }
      ).populate("captures");

      if (!updatedCollection) {
        return ErrorResponse({
          res,
          statusCode: 404,
          message: "Collection not found",
        });
      }

      return SuccessResponse({
        res,
        data: updatedCollection,
        message: "Collection updated successfully",
      });
    } catch (error) {
      console.error("[Collection] Update error:", error);
      return ErrorResponse({
        res,
        statusCode: 500,
        message: "Failed to update collection",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },

  /**
   * Get all captures in a specific collection
   */
  async getCollectionCaptures(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id || !validateObjectId(id)) {
        return ErrorResponse({
          res,
          statusCode: 400,
          message: "Invalid collection ID",
        });
      }

      const collection = await Collection.findById(id).populate({
        path: "captures",
        populate: {
          path: "collection",
          model: "Collection",
        },
      });

      if (!collection) {
        return ErrorResponse({
          res,
          statusCode: 404,
          message: "Collection not found",
        });
      }

      return SuccessResponse({
        res,
        data: collection.captures || [],
        message: "Collection captures retrieved successfully",
      });
    } catch (error) {
      console.error("[Collection] Get captures error:", error);
      return ErrorResponse({
        res,
        statusCode: 500,
        message: "Failed to retrieve collection captures",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
};
