import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme/themes.css'
import App from './App.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'
import { getBrand, applyBrand, loadBrandFromServer } from './branding/brand.js'

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

// Marca cacheada al instante (colores/título/favicon), luego se confirma con el servidor.
applyBrand(getBrand());

const root = createRoot(document.getElementById('root'));
function render() {
  root.render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>,
  );
}
render();

// Resolver la marca desde el servidor y re-renderizar para reflejar logo/nombre.
loadBrandFromServer().then(render);
