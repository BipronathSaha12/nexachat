# NexaChat

![NexaChat Banner](https://via.placeholder.com/1000x200.png?text=NexaChat)

Welcome to **NexaChat**, a modern, highly responsive, and accessible AI chatbot interface designed to provide a seamless conversational experience. 

NexaChat aims to deliver an unparalleled user experience through a polished UI/UX, robust syntax highlighting, real-time response streaming, and adherence to the highest web accessibility standards (WCAG).

---

## 🏗 Architecture

The NexaChat platform is architected into two decoupled components:

1. **Frontend (React + Vite)**  
   A lightning-fast, single-page application built with React, Vite, and TailwindCSS. It handles state management, dynamic theming, and real-time Markdown/Code rendering.
   
2. **Backend (Python)**  
   A robust backend service responsible for managing API communications, user authentication, and serving server-sent events (SSE) for streaming AI responses directly to the client.

---

## 📖 Documentation Directory

To get started with local development or deployment, please refer to the dedicated documentation for each environment:

- 🎨 **[Frontend Documentation](./frontend.md)**: Setup instructions, UI architecture, and available scripts.
- ⚙️ **[Backend Documentation](./backend.md)**: Server setup, environment variables, and API structure.

---

## ✨ Key Features

- **Real-Time Streaming**: Watch the AI generate responses token-by-token with zero perceived latency.
- **Rich Text & Code**: Native support for Markdown rendering and beautiful syntax highlighting (via PrismJS) for over 15 programming languages.
- **Accessibility (a11y) First**: Fully verified via Axe DevTools for compliant contrast ratios, keyboard navigation, and aria-labels.
- **Dynamic Theming**: Built-in support for System, Light, and Dark modes.
- **Conversation Management**: Automatically groups chats by recency (Today, Yesterday, Previous 7 days, Older) for easy retrieval.

---

## 📜 License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/BipronathSaha12/nexachat/blob/main/LICENSE) file for details.
