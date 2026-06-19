# CeShark ERP Modular

> **Última actualización:** 2026-06-02
> **Stack:** FastAPI + PostgreSQL + React 19 + TailwindCSS v4
> **Raíz:** `D:\PROYECTOS\ERP_MODULO\erp-modular\`

---

## Inicio rápido

```powershell
cd D:\PROYECTOS\ERP_MODULO\erp-modular
.\iniciar.bat       # abre backend + frontend + navegador
```

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| API | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |

---

## Documentación del proyecto (carpeta docs/)

| Archivo | Qué contiene |
|---------|-------------|
| [docs/PROMPT_NUEVO_CHAT.md](docs/PROMPT_NUEVO_CHAT.md) | **← EMPIEZA AQUÍ** Prompt para continuar en un nuevo chat con Claude |
| [docs/ESTADO_ACTUAL.md](docs/ESTADO_ACTUAL.md) | Fases completadas, migraciones aplicadas, módulos activos |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Próximas fases con esquemas SQL y endpoints detallados |
| [docs/CONVENCIONES.md](docs/CONVENCIONES.md) | Reglas de código obligatorias para no romper el proyecto |

---

## Estado en una línea

**Fases completadas:** Cotizaciones APU · OTs · Compras/OC · Clientes + Ciclo Comercial

**Flujo implementado:**
```
Cliente → Cotización (BORRADOR→ENVIADA→APROBADA) → OTs en campo
→ Consumo de stock automático al cerrar OT
→ Si falta stock: OC al proveedor → Recepción → stock IN automático
```

**Próxima fase sugerida:** Ver [docs/ROADMAP.md](docs/ROADMAP.md)

---

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3 · FastAPI · Uvicorn · PostgreSQL · psycopg2 · JWT |
| Frontend | React 19 · Vite · TailwindCSS v4 · React Router DOM v7 |
| Exportación | reportlab 4.2.5 (PDF) · openpyxl 3.1.5 (Excel) |

## Design tokens

| Token | Valor | Uso |
|-------|-------|-----|
| PRIMARY | `#0B2E33` | Sidebar, headers |
| ACCENT | `#4F7C82` | Botones, links |
| ACCENT_TEXT | `#B8E3E9` | Texto sobre PRIMARY |
| LIGHT | `#EEF7F8` | Fondos cards |
