# NexaChat Frontend

The frontend is a fast, responsive React application built with Vite and TailwindCSS.

## Features
- **Markdown Support**: Renders complex markdown formatting natively.
- **Syntax Highlighting**: Beautiful code blocks using PrismJS (`react-syntax-highlighter`).
- **Dark/Light Mode**: Full theme support with OS-level syncing.
- **Accessible Design**: Built keeping web accessibility guidelines (WCAG) in mind (verified via Axe DevTools).

## Prerequisites
- Node.js (v18+)
- npm or yarn

## Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```

## Development Server
To start the local Vite development server:
```bash
npm run dev
```
The app will be available at `http://localhost:5173`.

## Building for Production
To create a production-ready bundle:
```bash
npm run build
```
The output will be placed in the `dist/` directory.
