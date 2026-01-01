# LinkMeld Backend

## Overview

**LinkMeld** is a scalable backend service for capturing, storing, processing, and enriching web content (webpages, PDFs, videos, images, and more) for users and workspaces. It leverages modern AI (Google Gemini), semantic search (Qdrant), and a microservice architecture to provide advanced document understanding, summarization, and knowledge management capabilities.

---

## Key Features
- **Content Capture:** Save and organize webpages, PDFs, videos, images, and other documents.
- **Metadata Extraction:** Automatically extract and store metadata (title, description, keywords, word count, reading time, etc.).
- **AI/ML Enrichment:** Generate summaries and embeddings using Google Gemini; enable semantic search and document Q&A.
- **Graph Relationships:** Link documents via references, citations, and related content.
- **Multi-format Support:** Handle various content types and attachments.
- **Privacy & Versioning:** Control access, privacy, and document versioning.
- **Worker-based Processing:** Background workers for PDF, AI, and embedding tasks.

---

## Architecture

```
+-------------------+      +-------------------+      +-------------------+
|    API Service    |<---->|   MongoDB (Data)  |<---->|   Workers (PDF,   |
| (Express/Node.js) |      +-------------------+      |   AI, Embedding)  |
+-------------------+      |                   |      +-------------------+
        |                  |                   |               |
        v                  |                   |               v
+-------------------+      |                   |      +-------------------+
|  Redis (Queue/    |<------------------------+      |  Qdrant (Vector DB)|
|   Cache)          |                                 +-------------------+
+-------------------+                                 |  Azure Blob       |
                                                      |  Storage         |
                                                      +-------------------+
```

- **API Service:** Main REST API for clients (users, extensions, integrations).
- **Workers:** Microservices for heavy processing (PDF extraction, AI summarization, embedding generation).
- **MongoDB:** Primary data store for captures, users, metadata, etc.
- **Qdrant:** Vector database for storing and searching embeddings (semantic search).
- **Redis:** Job queue and cache for background processing.
- **Azure Blob Storage:** Stores file attachments and large assets.
- **Google Gemini:** Provides AI-powered summarization and embeddings.

---

## Getting Started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- MongoDB, Redis, Qdrant, Azure Blob Storage, Google Gemini API credentials

### Installation
1. **Clone the repository:**
   ```bash
   git clone https://github.com/Nathanim1919/LinkMeld-backend.git
   cd LinkMeld-backend
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure environment variables:**
   - Copy `.env.example` to `.env` and fill in required values (see below).
4. **Start services (development):**
   ```bash
   docker-compose up --build
   ```
   - This will start the API, workers, MongoDB, Redis, and Qdrant.

---

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
NODE_ENV=development
MONGO_URI=mongodb://mongo:27017/linkmeld
REDIS_URL=redis://redis:6379
AZURE_STORAGE_CONNECTION_STRING=your_azure_blob_connection_string
GEMINI_API_KEY=your_google_gemini_api_key
GCP_PROJECT=your_gcp_project_id
GCP_LOCATION=your_gcp_location
GOOGLE_APPLICATION_CREDENTIALS=path_to_gcp_credentials.json
```

---

## Usage

- **API:**
  - The main API runs on port `3000` by default.
  - Endpoints for captures, users, collections, feedback, and AI features.
- **Workers:**
  - PDF, AI, and embedding workers run as separate services for background processing.
- **Vector Search:**
  - Qdrant is used for semantic search and document similarity.
- **File Storage:**
  - Attachments and large files are stored in Azure Blob Storage.

---

## Technologies Used
- **Node.js, Express** — API and worker services
- **MongoDB** — Document database
- **Redis** — Queue and cache
- **Qdrant** — Vector database for embeddings
- **Azure Blob Storage** — File storage
- **Google Gemini** — AI summarization and embeddings
- **Docker, Docker Compose** — Containerization and orchestration
- **TypeScript** — Type safety

---

## Contributing

Contributions are welcome! Please open issues or submit pull requests for improvements, bug fixes, or new features.

---

## License

This project is licensed under the ISC License.

---

## Contact

For questions, support, or feedback, please open an issue on [GitHub](https://github.com/Nathanim1919/LinkMeld-backend/issues).
