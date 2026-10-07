import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { applyStoredTheme } from './theme/useTheme'
import './index.css'

// Before the first paint, so the wrong palette never flashes.
applyStoredTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
