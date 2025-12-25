import { Router } from "express";
import { authentication } from "../middleware/authMiddleware";
import { AIController } from "../controllers/aiController";
import { rateLimiter } from "../middleware/rateLimiter";

const router = Router();

// Apply authentication middleware to all routes in this router
router.use(authentication);

// Route to converse with AI
router.post("/converse", AIController.chat);
router.post("/summary", rateLimiter("strict"), AIController.generateSummary);
router.get("/models", AIController.listModels);

// Export the router
export default router;
