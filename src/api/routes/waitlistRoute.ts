import { Router } from "express";
import { joinWaitlist } from "../controllers/waitlistController";


const router = Router();


router.post("/join", joinWaitlist);


export default router;