import { Response } from "express";
import { logger } from "./logger";
import { config } from "../config/config";

interface SuccessResponseParams {
  res: Response;
  statusCode?: number;
  data?: any;
  message?: string;
  metadata?: any;
}

interface ErrorResponseParams {
  res: Response;
  statusCode?: number;
  message?: string;
  error?: any;
  errorCode?: string | null;
}

/**
 * Standardized success response handler
 */
export const SuccessResponse = ({
  res,
  statusCode = 200,
  data = null,
  message = "Success",
  metadata = {},
}: SuccessResponseParams): void => {
  logger.info(`SuccessResponse: ${message}`, { statusCode, metadata });

  res.status(statusCode).json({
    success: true,
    message,
    data,
    ...metadata,
  });
};

/**
 * Standardized error response handler
 */
export const ErrorResponse = ({
  res,
  statusCode = 500,
  message = "Internal Server Error",
  error = null,
  errorCode = null,
}: ErrorResponseParams): void => {
  logger.error(`ErrorResponse: ${message}`, { 
    statusCode, 
    errorCode,
    error: error instanceof Error ? error.message : error 
  });

  // Don't expose internal errors in production
  const errorResponse = {
    success: false,
    message,
    ...(config.env === "development" && { error: error?.message || error }),
    ...(errorCode && { errorCode }),
  };

  res.status(statusCode).json(errorResponse);
};