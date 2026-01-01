import { Request, Response } from "express";
import Waitlist from "../../common/models/Waitlist";
import { ErrorResponse, SuccessResponse } from "../../common/utils/responseHandlers";

export const joinWaitlist = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return ErrorResponse({
        res,
        statusCode: 400,
        message: "Please provide a valid email address.",
      });
    }

    // Optionally validate email format (basic regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return ErrorResponse({
        res,
        statusCode: 400,
        message: "Invalid email format. Please check and try again.",
      });
    }

    // Check if email already exists (optional, but user-friendly)
    const existing = await Waitlist.findOne({ email });
    if (existing) {
      return SuccessResponse({
        res,
        statusCode: 200,
        message: "You're already on the waitlist. We'll keep you posted!",
      });
    }

    // Create waitlist entry
    const waitlistEntry = await Waitlist.create({ email });

    if (!waitlistEntry) {
      return ErrorResponse({
        res,
        statusCode: 500,
        message: "Something went wrong while joining the waitlist. Please try again later.",
      });
    }

    return SuccessResponse({
      res,
      statusCode: 200,
      message: "You're on the waitlist! We'll let you know when Deepen is ready.",
    });
  } catch (error) {
    console.error("Join waitlist error:", error);
    return ErrorResponse({
      res,
      statusCode: 500,
      message: "Unexpected error occurred. Please try again later.",
    });
  }
};
