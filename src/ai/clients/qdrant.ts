import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_CLOUD_URL = process.env.QDRANT_CLOUD_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

const qdrant = new QdrantClient({
  url: QDRANT_CLOUD_URL,
  apiKey: QDRANT_API_KEY,
});

// You can now export this client to use across your Express routes
export { qdrant };
