// Import RequestHandler along with the others
// file name is auth.middleware.ts
import { Request, Response, NextFunction, RequestHandler } from "express";
import { auth } from "../../lib/auth";
import { fromNodeHeaders } from "better-auth/node";

// Extend the Express Request type to include the user property
declare global {
  namespace Express {
    export interface Request {
      user?: any; // You can define a more specific User type here
    }
  }
}

export const authentication: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const headers = fromNodeHeaders(req.headers);

    const session = await auth.api.getSession({
      headers: headers,
    });

    if (!session) {
      // It's good practice to add a `return` here to make the exit point explicit
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    req.user = session.user;
  } catch (error) {
    console.error("Authentication error:", error);
    // You can also add a return here
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
  next();
};
