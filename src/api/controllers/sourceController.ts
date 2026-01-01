import { Request, Response } from "express";
import { Capture } from "../../common/models/Capture";
import { Types } from "mongoose";
import { ErrorResponse, SuccessResponse } from "../../common/utils/responseHandlers";

/**
 * Helper method to find captures by site name
 */
const findCapturesBySite = async (userId: Types.ObjectId, siteName: string) => {
  return await Capture.find({
    "metadata.siteName": siteName,
    owner: userId,
  })
    .sort({ timestamp: -1 })
    .populate("collection", "name")
    .exec();
};

/**
 * Get all distinct site names with counts
 */
export const getAllDistinctSites = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = new Types.ObjectId(req.user.id);

    // Get distinct site names
    const siteNames = await Capture.distinct("metadata.siteName", {
      owner: userId,
      "metadata.siteName": { $ne: "" } // Exclude empty strings
    });

    if (!siteNames || siteNames.length === 0) {
      return ErrorResponse({
        res,
        statusCode: 404,
        message: "No distinct site names found for user",
      });
    }

    // Get counts per site name
    const siteNameCounts = await Capture.aggregate([
      { $match: { owner: userId } },
      {
        $group: {
          _id: "$metadata.siteName",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          siteName: "$_id",
          count: 1,
          _id: 0,
        },
      },
    ]);

    // Convert to map for easier client-side usage
    const siteNameMap = siteNameCounts.reduce((acc, { siteName, count }) => {
      acc[siteName] = count;
      return acc;
    }, {} as Record<string, number>);

    return SuccessResponse({
      res,
      message: "Distinct site names retrieved successfully",
      data: {
        siteNames,
        counts: siteNameMap,
      },
    });
  } catch (error) {
    console.error("[Capture] Distinct sites error:", error);
    return ErrorResponse({
      res,
      statusCode: 500,
      message: "Failed to retrieve distinct site names",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get captures by site name from query parameter
 */
export const getCapturesBySiteQuery = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { siteName } = req.query;

    // Validate input
    if (!siteName || typeof siteName !== "string") {
      return ErrorResponse({
        res,
        statusCode: 400,
        message: "Valid siteName query parameter is required",
      });
    }

    const userId = new Types.ObjectId(req.user.id);
    const captures = await findCapturesBySite(userId, siteName);

    return SuccessResponse({
      res,
      message: `Captures for site '${siteName}' retrieved successfully`,
      data: captures,
    });
  } catch (error) {
    console.error("[Capture] Site query error:", error);
    return ErrorResponse({
      res,
      statusCode: 500,
      message: "Failed to retrieve captures by site name",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Get captures by site name from route parameter
 */
export const getCapturesBySiteParam = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { siteName } = req.params;

    // Validate input
    if (!siteName) {
      return ErrorResponse({
        res,
        statusCode: 400,
        message: "Site name parameter is required",
      });
    }

    const userId = new Types.ObjectId(req.user.id);
    const captures = await findCapturesBySite(userId, siteName);

    return SuccessResponse({
      res,
      message: `Captures for site '${siteName}' retrieved successfully`,
      data: captures,
    });
  } catch (error) {
    console.error("[Capture] Site param error:", error);
    return ErrorResponse({
      res,
      statusCode: 500,
      message: "Failed to retrieve captures by site name",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Export all functions as an object if you need to maintain the previous structure
export default {
  getAllDistinctSites,
  getCapturesBySiteQuery,
  getCapturesBySiteParam,
  findCapturesBySite,
};
