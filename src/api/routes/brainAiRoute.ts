import express from "express";
import { BrainChatController } from "../controllers/brainChatController";
import { authentication } from "../middleware/authMiddleware";
const router = express.Router();

// Apply authentication middleware to all routes in this router
router.use(authentication);

router.post("/conversation/start", BrainChatController.startConversation);

router.post("/conversation/:conversationId/message", BrainChatController.sendMessage);
router.get("/conversation/:conversationId/message", BrainChatController.sendMessage);

// conversation summary
router.post("/conversation/summary", (req, res) => {
  res.send("Hello World");
});

// get conversation history
router.get("/conversations", BrainChatController.conversationsList);


// delete conversation
router.delete("/conversation/delete", (req, res) => {
  res.send("Hello World");
});

// delete all conversations
router.delete("/conversation/delete-all", (req, res) => {
  res.send("Hello World");
});


// get conversation
router.get("/conversation/:conversationId", BrainChatController.getConversation);



export default router;