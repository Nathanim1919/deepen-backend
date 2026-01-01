import express from "express";
import {
  getFeedback,
  setFeedbackDisplayToTrue,
  submitFeedback,
} from "../controllers/feedbackController";
import { rateLimiter } from "../middleware/rateLimiter";

const router = express.Router();

/**
 * @route   POST /api/feedback
 * @desc    Submit user feedback
 * @access  Public
 */
router.post("/", rateLimiter("strict"), submitFeedback);
/**
 * @route   GET /api/feedback
 * @desc    Get all user feedback
 * @access  Public
 */
router.get("/", getFeedback);

/**
 * @route POST /api/feedback/:feedbackId/display
 * @desc SET the feedback display to true
 * @access Public
 */
router.post("/:feedbackId/display", setFeedbackDisplayToTrue);
export default router;
