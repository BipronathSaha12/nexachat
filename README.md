# NexaChat

![NexaChat Banner](https://via.placeholder.com/1000x200.png?text=NexaChat)

Welcome to **NexaChat**, a modern, highly responsive, and accessible AI chatbot interface designed to provide a seamless conversational experience using the Gemini AI API.

## 🏗 Architecture & Tech Stack

- **Frontend**: React 18 + Vite + TailwindCSS.
- **Backend**: Django (Python) providing REST APIs and Server-Sent Events (SSE) for streaming AI responses.
- **Database**: PostgreSQL (via Neon) for production, SQLite3 for local development.

---

## 🚀 Deployment Guide

### 1. Database Deployment (Neon)
NexaChat is designed to use **PostgreSQL** in production. 
1. Create a free PostgreSQL database on [Neon.tech](https://neon.tech/).
2. Copy the connection string (e.g., `postgres://user:password@ep-name.region.aws.neon.tech/dbname`).

### 2. Backend Deployment (Render)
The Django backend is optimized for deployment on [Render](https://render.com).
1. Create a new **Web Service** on Render and connect your GitHub repository.
2. Set the Root Directory to `backend`.
3. **Build Command**: `pip install -r requirements.txt && python manage.py migrate`
4. **Start Command**: `gunicorn config.wsgi:application` (or your ASGI equivalent like Daphne for streaming).
5. **Environment Variables**:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string.
   - `GEMINI_API_KEY`: Your Google Gemini API key.
   - `SECRET_KEY`: A strong, randomly generated string.
   - `ALLOWED_HOSTS`: Your Render domain (e.g., `your-app.onrender.com`).
   - `CORS_ALLOWED_ORIGINS`: Your Vercel frontend URL.

### 3. Frontend Deployment (Vercel)
The Vite/React frontend is built perfectly for [Vercel](https://vercel.com).
1. Import your GitHub repository to Vercel.
2. Set the Framework Preset to **Vite**.
3. Set the Root Directory to `frontend`.
4. **Environment Variables**:
   - Add the necessary environment variables to point your frontend to your Render backend (e.g., `VITE_API_URL=https://your-app.onrender.com`).
5. Click **Deploy**.

---

## 📖 Documentation Directory
For local development instructions, see:
- 🎨 **[Frontend Documentation](./frontend.md)**: Local setup and UI architecture.
- ⚙️ **[Backend Documentation](./backend.md)**: Local Django setup and environment variables.

## 📜 License
This project is licensed under the MIT License. See the [LICENSE](https://github.com/BipronathSaha12/nexachat/blob/main/LICENSE) file for details.
