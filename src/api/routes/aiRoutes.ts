import express from "express";

const router = express.Router();

router.post("/models/list", (req, res) => {
  res.send("Hello World");
});

export default router;