import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme/themes.css'
import App from './App.jsx'
import { ThemeProvider } from './theme/ThemeProvider.jsx'
import { getBrand, applyBrand, loadBrandFromServer } from './branding/brand.js'
import { initObservability } from './services/observability.js'

// Sentry primero, para capturar también los fallos del propio arranque.
// Sin VITE_SENTRY_DSN es un no-op (F-000 / T-04).
initObservability();

// Tema fijo: solo modo claro.
document.documentElement.dataset.theme = 'zeit-claro';

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
