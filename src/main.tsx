import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// KaTeX styles and fonts are bundled locally: formulas render offline.
import 'katex/dist/katex.min.css'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
