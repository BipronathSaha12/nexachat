# NexaChat Backend

The NexaChat backend is a robust Python service built on Django. It handles user authentication, conversation persistence, and real-time streaming of AI-generated responses from Google's Gemini models.

---

## 🛠 Tech Stack

- **Language**: Python 3.9+
- **Framework**: Django
- **Database**: SQLite3 (Local) / PostgreSQL (Production via Neon)
- **AI Integration**: Google Gemini API
- **Dependencies**: Managed via standard `requirements.txt`

---

## 🚀 Local Development Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment**:
   - **Windows**: 
     ```bash
     python -m venv .venv
     .venv\Scripts\activate
     ```
   - **macOS/Linux**: 
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment Variables**:
   Copy `.env.example` to `.env` and fill in:
   - `GEMINI_API_KEY`: Your Gemini API key from Google AI Studio.
   - Leave `DATABASE_URL` empty to default to local SQLite, or add a Neon Postgres URL.

5. **Run Migrations**:
   Setup your database schema:
   ```bash
   python manage.py migrate
   ```

6. **Start the Development Server**:
   ```bash
   python manage.py runserver
   ```
   The backend will typically be available at `http://127.0.0.1:8000`.

---

## 🧠 Core Capabilities

- **Streaming Architecture**: Leverages Server-Sent Events (SSE) to stream tokens directly to the frontend, ensuring zero perceived latency for large AI responses.
- **Conversation State**: Django models maintain chat history to provide contextual awareness for subsequent prompts.
- **Robust Error Handling**: Standardized error responses to gracefully handle token limits, API timeouts, and authentication failures.
