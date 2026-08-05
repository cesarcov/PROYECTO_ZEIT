# Quickstart / Guía de Validación: Paleta Corporativa y Tokens de Tema

**Feature**: 009-paleta-tokens-tema
**Fecha**: 2026-07-05

---

## Prerrequisitos

- Backend corriendo en `http://127.0.0.1:8000`
- Frontend corriendo en `http://localhost:5173`
- Base de datos con migración `041` aplicada
- Usuario administrador; credenciales en `TEST_ADMIN_USER` / `TEST_ADMIN_PASSWORD` del entorno
- Usuario `superadmin` disponible

---

## Escenario 1: Cambio de tema claro ↔ oscuro

1. Abrir el ERP en cualquier navegador.
2. Ir a **Preferencias** (icono de engranaje en el header o menú de usuario).
3. En la sección de apariencia, verificar que **solo aparezcan dos opciones**: "Claro" y "Oscuro".
4. Seleccionar "Oscuro".

**Resultado esperado**:
- La interfaz cambia inmediatamente (< 300ms, sin parpadeo).
- El fondo del contenido principal es **Azul Navy** (`#001F54`), no negro.
- Los paneles de contenido son ligeramente más claros (`#0D2545`).
- El texto de cuerpo es near-white (`#E8EEF9`).
- El sidebar permanece oscuro (`#001240`).

5. Navegar a Logística, Operaciones y Cotizaciones — verificar legibilidad en cada módulo.
6. Recargar la página (F5) — el tema oscuro debe persistir.
7. Cerrar sesión y volver a entrar — el tema oscuro debe restaurarse automáticamente.

---

## Escenario 2: Configurar los 4 colores corporativos

1. Entrar como `admin`.
2. Ir a **Admin → Branding**.
3. Verificar que la pantalla muestra exactamente **4 campos de color**:
   - Color Primario
   - Color de Acento
   - Color de Acción
   - Color de Texto Secundario
4. Cambiar "Color Primario" a `#1A3A8C` (azul ligeramente diferente).
5. Presionar "Vista Previa" (si existe) o "Guardar".

**Resultado esperado**:
- El sidebar, encabezados y elementos de navegación cambian al nuevo azul en tiempo real.
- El logo y nombre del ERP no se ven afectados (esos son campos separados).

6. Verificar con herramienta WebAIM Contrast Checker que el blanco sobre `#1A3A8C` tiene ratio ≥ 4.5:1.

---

## Escenario 3: Validación de contraste (bloqueo de color inválido)

1. En **Admin → Branding**, cambiar "Color de Texto Secundario" a `#CCCCCC` (gris muy claro).
2. Presionar "Guardar".

**Resultado esperado**:
- El sistema muestra una advertencia: "El color elegido tiene contraste insuficiente (X.X:1). Mínimo requerido: 4.5:1."
- El botón "Guardar" permanece desactivado hasta que se corrija el color.
- La combinación problemática se indica visualmente (ej. borde rojo en el campo).

3. Cambiar "Color de Texto Secundario" a `#4A5566` (gris oscuro) y guardar.

**Resultado esperado**:
- La advertencia desaparece.
- El guardado procede correctamente.
- El token `--text-muted` en la UI cambia al nuevo color.

---

## Escenario 4: Restaurar paleta por defecto

1. En **Admin → Branding**, presionar "Restaurar valores ZEIT".

**Resultado esperado**:
- Los 4 campos de color vuelven a:
  - Primario: `#003A8C`
  - Acento: `#00D4D8`
  - Acción: `#FF6B00`
  - Texto Secundario: `#5A6573`
- La UI refleja los colores corporativos originales.

---

## Escenario 5: Verificación visual de equilibrio

1. En tema **Claro**, navegar al Dashboard.

**Verificar**:
- El fondo del área de contenido NO es blanco puro (`#FFFFFF`), sino gris muy suave (`#F4F6FA`).
- El sidebar tiene el azul corporativo `#001F54` (oscuro, contrasta con el contenido claro).
- Los encabezados de sección usan el azul primario `#003A8C`.
- Las tarjetas de KPI tienen fondo blanco con sombra sutil.

2. En tema **Oscuro**, navegar al Dashboard.

**Verificar**:
- El fondo NO es negro (`#000000`), sino Azul Navy corporativo (`#001F54`).
- Las tarjetas tienen un azul ligeramente más claro (`#0D2545`).
- Los textos son near-white — sin dificultad para leer tablas, etiquetas y valores.
- Los botones primarios (Naranja Energía `#FF6B00`) son claramente visibles sobre el fondo oscuro.

---

## Checklist de validación rápida

| Criterio | Como validar | Pass |
|---|---|---|
| Solo 2 temas en Preferencias | Contar opciones en el dropdown/toggle | ☐ |
| Tema oscuro usa `#001F54` como bg | Inspeccionar elemento → `--bg` en `:root` | ☐ |
| Texto sobre fondo oscuro ≥ 4.5:1 | WebAIM Contrast: `#E8EEF9` sobre `#001F54` = 12.1:1 ✓ | ☐ |
| 4 campos en AdminBranding | Contar inputs de color en la pantalla | ☐ |
| Bloqueo de contraste insuficiente | Intentar guardar gris claro sobre fondo claro | ☐ |
| Persistencia de tema | Recargar y verificar tema activo | ☐ |
| Tokens de branding se aplican en vivo | Cambiar primario y ver sidebar actualizado | ☐ |
