# NexaChat Backend

The backend of NexaChat is built using Python. It serves the API endpoints and manages the streaming of AI responses to the frontend.

## Prerequisites
- Python 3.9+
- `pip` or `uv` for dependency management

## Setup

1. **Navigate to the backend directory** (if applicable) or project root.
2. **Create a virtual environment**:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
   ```
3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
4. **Environment Variables**:
   Copy `.env.example` to `.env` and fill in your API keys (like Gemini API keys) and configuration variables.

## Running the Server
Start the development server (using Uvicorn, assuming it's a FastAPI/Starlette app):
```bash
uvicorn main:app --reload
```
(Modify the `main:app` import based on your exact app entrypoint).

## Architecture
- Streaming support for conversational generation.
- Handles user authentication and conversation persistence.
