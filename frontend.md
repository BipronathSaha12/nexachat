# NexaChat Frontend

The NexaChat frontend is a high-performance Single Page Application (SPA) built to deliver a smooth and engaging conversational AI interface.

---

## 🛠 Tech Stack

- **Framework**: [React 18](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/) (for blazing fast HMR and optimized builds)
- **Styling**: [TailwindCSS v4](https://tailwindcss.com/) (Utility-first CSS framework with custom design tokens)
- **Syntax Highlighting**: `react-syntax-highlighter` (PrismJS)
- **Routing**: `react-router-dom`

---

## 🚀 Getting Started

Follow these steps to set up the frontend environment locally.

### Prerequisites
- **Node.js**: v18.0.0 or higher.
- **Package Manager**: `npm` (or `yarn`/`pnpm`).

### Installation

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install all dependencies**:
   ```bash
   npm install
   ```

### Running the Development Server

To spin up the local development server with Hot Module Replacement (HMR):

```bash
npm run dev
```

The application will be accessible at `http://localhost:5173` (or the next available port).

---

## 🏗 Project Structure

```text
frontend/
├── src/
│   ├── components/      # Reusable UI components (Sidebar, CodeBlock, ChatInput, etc.)
│   ├── pages/           # Route-level components (Chat, Login, Register)
│   ├── auth/            # Authentication context and hooks
│   ├── theme/           # Theme context for Light/Dark mode toggling
│   ├── index.css        # Global CSS and Tailwind theme tokens
│   └── main.jsx         # React application entry point
├── public/              # Static assets (favicons, etc.)
├── tailwind.config.js   # Tailwind configuration
└── vite.config.js       # Vite configuration
```

---

## 🎨 Design System & Theming

NexaChat uses a sophisticated color token system via TailwindCSS. 
Colors are defined in `oklch` format within `src/index.css` to ensure perfect contrast and vibrancy across both **Light** and **Dark** modes. The theme preference is automatically synced with the user's OS, but can be manually overridden via the Theme Toggle button in the sidebar.

---

## 📦 Building for Production

To create an optimized, minified production build:

```bash
npm run build
```

This will generate a `dist/` directory containing static files ready to be deployed to any static hosting service (Vercel, Netlify, AWS S3, etc.).
