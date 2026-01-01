import { Router } from "express";
import { authentication } from "../middleware/authMiddleware";
import collectionController from "../controllers/collectionController";

const router = Router();

// Apply authentication middleware to all collection routes
router.use(authentication);

/**
 * @route POST /collections
 * @desc Create a new collection
 * @access Private
 */
router.post("/", collectionController.createCollection);

/**
 * @route GET /collections
 * @desc Get all collections for authenticated user
 * @access Private
 */
router.get("/", collectionController.getCollections);

/**
 * @route GET /collections/:id
 * @desc Get a specific collection by ID
 * @access Private
 */
router.get("/:id", collectionController.getCollectionById);

/**
 * @route POST /collections/:id/captures
 * @desc Add a capture to a collection
 * @access Private
 */
router.post("/:id/captures", collectionController.addCaptureToCollection);

/**
 * @route DELETE /collections/captures
 * @desc Remove a capture from a collection
 * @access Private
 */
router.delete("/captures", collectionController.removeCaptureFromCollection);

/**
 * @route GET /collections/:id/captures
 * @desc Get all captures in a specific collection
 * @access Private
 */
router.get("/:id/captures", collectionController.getCollectionCaptures);

/**
 * @route PUT /collections/:id
 * @desc Update collection details
 * @access Private
 */
router.put("/:id", collectionController.updateCollection);

/**
 * @route DELETE /collections/:id
 * @desc Delete a collection
 * @access Private
 */
router.delete("/:id", collectionController.deleteCollection);

export default router;