import { Router } from "express";
import { authentication } from "../middleware/authMiddleware";
import { rateLimiter } from "../middleware/rateLimiter";
import { UserProfileController } from "../controllers/userControler";

const router = Router();

// Global middleware for all user profile routes
router.use(authentication);

/**
 * @route   POST /user/reset
 * @desc    Reset all user data (sensitive operation)
 * @access  Private
 * @rate    Strictly limited (5 requests/hour)
 */
router.post(
  "/reset",
  rateLimiter("strict"),
  UserProfileController.resetAllData
);

/**
 * @route   POST /user/setGeminiApiKey
 * @desc    Set or update Gemini API key (sensitive operation)
 * @access  Private
 * @rate    Strictly limited (5 requests/hour)
 */
router.post(
  "/setGeminiApiKey",
  rateLimiter("strict"),
  UserProfileController.upsertGeminiApiKey
);

/**
 * @route   GET /user/profile
 * @desc    Get user profile information
 * @access  Private
 */
router.get("/profile", UserProfileController.getUserProfile);

export const userProfileRoutes = router;
