import { config } from "../config/config";
import winston from "winston";

const { combine, timestamp, json, errors, prettyPrint } = winston.format;

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Determine logging level based on environment
const level = () => {
  return config.env === "development" ? "debug" : "info";
};

// Define log format
const logFormat = combine(
  timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  errors({ stack: true }),
  config.env === "development" ? prettyPrint() : json()
);

// Define transports
const transports = [
  new winston.transports.Console(),
  new winston.transports.File({
    filename: "logs/error.log",
    level: "error",
  }),
  new winston.transports.File({ filename: "logs/all.log" }),
];

// Create logger instance
export const logger = winston.createLogger({
  level: level(),
  levels,
  format: logFormat,
  transports,
  defaultMeta: { service: "api-service" },
});

// Stream for morgan HTTP logging
export const httpLogStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};