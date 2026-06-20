import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme/themes.css'
import App from './App.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'

// Anti-parpadeo: aplica el tema guardado ANTES del primer render.
(() => {
  try {
    const t = localStorage.getItem('zeit_tema') || 'system';
    let efectivo = t;
    if (t === 'system') {
      const oscuro = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      efectivo = oscuro ? 'zeit-oscuro' : 'zeit-claro';
    }
    document.documentElement.dataset.theme = efectivo;
  } catch { /* noop */ }
})();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
