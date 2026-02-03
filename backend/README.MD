# Backend for Voice Agent

This backend is part of a voice agent system that leverages Elasticsearch for semantic search on website data and integrates with OpenAI's API for generating responses. It provides APIs for speech-to-text (STT) transcription using Whisper and chat-based querying, enabling a conversational interface for website-specific questions.

## Features

- **Speech-to-Text (STT)**: Accepts audio files and transcribes them to text using OpenAI's Whisper model.
- **Semantic Search**: Uses Elasticsearch to perform semantic searches on indexed website content.
- **Chat Response Generation**: Generates answers based on retrieved context using OpenAI's GPT models.
- **Source Grounding**: Retrieves and returns source titles and URLs for transparency and verification.
- **CORS Support**: Configured for cross-origin requests, suitable for frontend integration.
- **Environment-Based Configuration**: Loads sensitive data (e.g., API keys) from environment variables.

## Prerequisites

- Python 3.10 or higher
- Elasticsearch cluster (configured with semantic search capabilities)
- OpenAI API key
- Virtual environment (recommended)

## Installation

1. **Clone the Repository** (if applicable) or navigate to the `backend` directory.

2. **Create and Activate a Virtual Environment**:
   ```bash
   python -m venv .demo
   source .demo/bin/activate  # On Windows: .demo\Scripts\activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Set Up Environment Variables**:
   Create a `.env` file in the `backend` directory with the following variables:
   ```
   ELASTIC_URL=<your-elasticsearch-url>
   ELASTIC_API_KEY=<your-elasticsearch-api-key>
   OPENAI_API_KEY=<your-openai-api-key>
   ```

   Example:
   ```
   ELASTIC_URL=https://my-cluster.es.us-central1.gcp.elastic.cloud:443
   ELASTIC_API_KEY=your_api_key_here
   OPENAI_API_KEY=sk-proj-your_openai_key_here
   ```

## Configuration

- **Elasticsearch Index**: The application expects an index named `websites_semantic_v0` with fields like `title`, `url`, and `body` for semantic search.
- **OpenAI API**: Ensure `OPENAI_API_KEY` is set for chat responses and STT transcription.
- **CORS**: Currently allows all origins (`allow_origins=["*"]`). Update for production security.

## Running the Application

1. **Start the Server**:
   ```bash
   uvicorn app.main:app --reload
   ```
   The server will run on `http://localhost:8000` by default.

2. **Access API Documentation**:
   Visit `http://localhost:8000/docs` for interactive Swagger UI documentation of the endpoints.

## API Endpoints

### POST /stt
Transcribes an uploaded audio file to text using OpenAI's Whisper API.

- **Request**: Multipart form data with an audio file (e.g., `file` field).
- **Supported Formats**: webm, wav, mp3, and other audio formats supported by Whisper.
- **Response**: JSON with `{"text": "<transcribed-text>"}`.
- **Example**:
  ```bash
  curl -X POST "http://localhost:8000/stt" \
    -F "file=@audio.wav"
  ```
- **Response Example**:
  ```json
  {
    "text": "What are your business hours?"
  }
  ```

### POST /chat
Processes a user query by searching Elasticsearch and generating a response via OpenAI's GPT model.

- **Request Body** (JSON):
  ```json
  {
    "query": "Your question here"
  }
  ```
- **Response** (JSON):
  ```json
  {
    "answer": "Generated answer based on context",
    "sources": [
      {
        "title": "Page Title",
        "url": "https://example.com/page"
      },
      {
        "title": "Another Page",
        "url": "https://example.com/another-page"
      }
    ]
  }
  ```
- **Process**:
  1. Performs semantic search on the Elasticsearch index (retrieves top 5 results).
  2. Retrieves relevant context from search results (title, url, body).
  3. Uses ES|QL query to extract page titles and URLs for source grounding.
  4. Constructs a prompt with context and sends it to OpenAI's GPT model.
  5. Returns the generated answer along with source citations.

- **Example**:
  ```bash
  curl -X POST "http://localhost:8000/chat" \
    -H "Content-Type: application/json" \
    -d '{"query": "What classes do you offer?"}'
  ```

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # FastAPI application with /stt and /chat endpoints
│   ├── elastic.py       # Elasticsearch client initialization
│   └── schemas.py       # Pydantic schemas for request/response validation
├── .env                 # Environment variables (not committed)
├── requirements.txt     # Python dependencies
└── README.MD            # This file
```

## Development Notes

- **STT Implementation**: The `/stt` endpoint uses OpenAI's Whisper API for accurate transcription across multiple audio formats.
- **LLM Integration**: The `/chat` endpoint uses OpenAI's GPT model with temperature set to 0 for deterministic responses.
- **Error Handling**: The application includes error handling for:
  - Missing/empty audio files (STT endpoint)
  - Elasticsearch connection failures
  - Empty search results
  - API failures from OpenAI
- **Security Considerations**:
  - In production, restrict CORS origins to specific domains.
  - Store API keys securely using environment variables or a secrets manager.
  - Validate and sanitize all user inputs.
  - Add rate limiting to prevent abuse.
  - Monitor API usage and set appropriate quotas.

## Troubleshooting

1. **Elasticsearch Connection Error**:
   - Verify `ELASTIC_URL` and `ELASTIC_API_KEY` are correct.
   - Ensure Elasticsearch cluster is accessible.
   - Check network connectivity and firewall rules.

2. **OpenAI API Error**:
   - Verify `OPENAI_API_KEY` is valid and has sufficient credits.
   - Check that the API key has access to the required models (Whisper, GPT).

3. **Empty Search Results**:
   - Ensure the Elasticsearch index `websites_semantic_v0` exists and is populated.
   - Verify semantic search is properly configured in your index.
   - Check that the query is semantically relevant to indexed content.

## Contributing

- Follow standard Python practices (e.g., PEP 8).
- Add tests for new features.
- Update this README for any changes.
- Document API modifications clearly.

## License

This project is licensed under the MIT License. See the main project README for details.