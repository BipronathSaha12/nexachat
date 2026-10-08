# NexaChat Backend

The NexaChat backend is a robust Python service designed to handle user authentication, conversation persistence, and real-time streaming of AI-generated responses.

---

## 🛠 Tech Stack

- **Language**: Python 3.9+
- **Framework**: FastAPI / Starlette (High-performance async API framework)
- **Server**: Uvicorn (ASGI web server)
- **Dependencies**: Managed via standard `requirements.txt`

---

## 🚀 Getting Started

Follow these steps to set up the Python backend locally.

### Prerequisites
- **Python**: Version 3.9 or higher.
- **Virtual Environment Tool**: `venv`, `uv`, or `virtualenv`.

### Installation

1. **Navigate to the backend directory** (or root if configured as such):
   ```bash
   cd backend
   ```

2. **Create a virtual environment**:
   Isolating your dependencies is highly recommended.
   ```bash
   python -m venv .venv
   ```

3. **Activate the virtual environment**:
   - **Windows**:
     ```bash
     .venv\Scripts\activate
     ```
   - **macOS/Linux**:
     ```bash
     source .venv/bin/activate
     ```

4. **Install required packages**:
   ```bash
   pip install -r requirements.txt
   ```

---

## ⚙️ Configuration

The backend relies on environment variables for sensitive configurations (like AI provider API keys, database URLs, and JWT secrets).

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and fill in the required values (e.g., `GEMINI_API_KEY`, etc.).

---

## 🏃 Running the Server

To start the backend in development mode (with auto-reload enabled):

```bash
uvicorn main:app --reload
```
*(Note: If your application entry point is different, adjust `main:app` to match your application factory or instance).*

The API will typically be available at `http://127.0.0.1:8000`. You can also access the auto-generated Swagger documentation at `http://127.0.0.1:8000/docs`.

---

## 🧠 Core Capabilities

- **Streaming Architecture**: Leverages Server-Sent Events (SSE) to stream tokens directly to the frontend, ensuring zero perceived latency for large AI responses.
- **Conversation State**: Maintains chat history to provide contextual awareness for subsequent prompts.
- **Robust Error Handling**: Standardized error responses to gracefully handle token limits, API timeouts, and authentication failures.
