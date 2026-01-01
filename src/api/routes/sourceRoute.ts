import express from "express";
import { authentication } from "../middleware/authMiddleware";
import {
  getAllDistinctSites,
  getCapturesBySiteParam,
  getCapturesBySiteQuery,
} from "../controllers/sourceController";

const router = express.Router();

// Apply authentication to all source routes
router.use(authentication);

/**
 * @route   GET /api/sources
 * @desc    Get all distinct site names with capture counts
 * @access  Private
 * @returns {object} Site names array with counts
 */
router.get("/", getAllDistinctSites);

/**
 * @route   GET /api/sources/search
 * @desc    Search captures by site name (via query parameter)
 * @access  Private
 * @query   {string} siteName - Site name to filter by
 * @returns {object} Filtered captures array
 */
router.get("/search", getCapturesBySiteQuery);

/**
 * @route   GET /api/sources/:siteName/captures
 * @desc    Get all captures for a specific site (via URL parameter)
 * @access  Private
 * @param   {string} siteName - Site name from URL
 * @returns {object} Filtered captures array
 */
router.get("/:siteName/captures", getCapturesBySiteParam);

export default router;
