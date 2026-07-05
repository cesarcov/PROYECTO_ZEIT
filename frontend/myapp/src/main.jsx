import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme/themes.css'
import App from './App.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'
import { getBrand, applyBrand, loadBrandFromServer } from './branding/brand.js'

// Anti-parpadeo: aplica el tema guardado ANTES del primer render.
// Solo se aceptan los 2 valores válidos; cualquier valor antiguo cae a zeit-claro.
(() => {
  try {
    const VALIDOS = new Set(['zeit-claro', 'zeit-oscuro']);
    const t = localStorage.getItem('zeit_tema');
    document.documentElement.dataset.theme = VALIDOS.has(t) ? t : 'zeit-claro';
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
