import express from "express";
import { authentication } from "../middleware/authMiddleware";
import { rateLimiter } from "../middleware/rateLimiter";
import {
  getBookmarkedCaptures,
  getCaptureById,
  getCaptures,
  saveCapture,
  searchCaptures,
  toggleBookmark,
  reProcessCapture,
  deleteCapture,
} from "../controllers/captureController";

const router = express.Router();

// Apply authentication middleware to all capture routes
router.use(authentication);

/**
 * @route   GET /api/captures
 * @desc    Get all captures for authenticated user
 * @access  Private
 */
router.get("/", getCaptures);

/**
 * @route   POST /api/captures
 * @desc    Save a new capture
 * @access  Private
 * @rate    Limited (15 requests/minute)
 */
router.post("/save", rateLimiter("strict"), saveCapture);

/**
 * @route   GET /api/captures/search
 * @desc    Search captures with pagination
 * @access  Private
 * @query   {string} query - Search term
 * @query   {number} [page=1] - Page number
 * @query   {number} [limit=10] - Items per page
 */
router.get("/search", searchCaptures);

/**
 * @route   GET /api/captures/bookmarked
 * @desc    Get all bookmarked captures
 * @access  Private
 */
router.get("/bookmarked", getBookmarkedCaptures);

/**
 * @route   GET /api/captures/:id
 * @desc    Get a specific capture by ID
 * @access  Private
 * @params  {string} id - Capture ID
 */
router.get("/:captureId", getCaptureById);

/**
 * @route   DELETE /api/captures/:captureId
 * @desc    Delete a specific capture by ID
 * @access  Private
 * @params  {string} captureId - Capture ID
 */
router.delete("/:captureId", deleteCapture);

/**
 * @route   PATCH /api/captures/:id/bookmark
 * @desc    Toggle bookmark status for a capture
 * @access  Private
 * @params  {string} id - Capture ID
 */
router.patch("/:captureId/bookmark", rateLimiter("standard"), toggleBookmark);

/**
 * @route POST /api/captures/process/retry
 * @desc Retry failed capture processing
 * @access Private
 * @query {string} query - Search term
 */
router.post("/:captureId/reprocess", rateLimiter("strict"), reProcessCapture);

export default router;
