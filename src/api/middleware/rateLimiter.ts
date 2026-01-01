// src/middleware/rateLimiter.ts
import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { ErrorResponse } from "../../common/utils/responseHandlers";
import { logger } from "../../common/utils/logger";

// Common rate limit options
const commonOptions = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  standard: {
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later",
  },
  strict: {
    max: 5, // Limit each IP to 5 requests per windowMs
    message:
      "Too many sensitive operations from this IP, please try again later",
  },
  // lets create very strict rate limit to prevent abuse
  // veryStrict: {
  //   max: 2, // Limit each IP to 2 requests per windowMs. it is 2 requests per 15 minutes
  //   message: "Too many requests, please try again later",
  // },
  
};

// Custom handler for rate limit exceeded
const handler = (req: Request, res: Response, options: any) => {
  logger.warn("Rate limit exceeded", {
    ip: req.ip,
    method: req.method,
    path: req.path,
  });

  ErrorResponse({
    res,
    statusCode: 429,
    message: options.message,
    errorCode: "RATE_LIMIT_EXCEEDED",
  });
};

// Create rate limiters
export const rateLimiter = (type: "standard" | "strict") => {
  return rateLimit({
    windowMs: commonOptions.windowMs,
    max: commonOptions[type].max,
    message: commonOptions[type].message,
    handler,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyGenerator: (req) => {
      // Use user ID if authenticated, otherwise fall back to IP
      return req.user?.id || req.ip;
    },
    skip: (req) => {
      // Skip rate limiting for admin users
      return req.user?.role === "admin";
    },
  });
};

// Specific rate limiters for convenience
export const standardLimiter = rateLimiter("standard");
export const strictLimiter = rateLimiter("strict");
