import dotenv from "dotenv";

dotenv.config();

interface Config {
  env: string;
  port: string | number;
  mongoUri: string;
//   jwtSecret: string;
//   jwtExpiration: string;
  corsOrigin: string;
}

// Validate required environment variables
const requiredEnvVars = [
  "NODE_ENV",
  "MONGO_URI",
//   "JWT_SECRET",
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
}

export const config: Config = {
  env: process.env.NODE_ENV || "development",
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI as string,
//   jwtSecret: process.env.JWT_SECRET as string,
//   jwtExpiration: process.env.JWT_EXPIRATION || "1d",
  corsOrigin: process.env.CORS_ORIGIN || "*",
};