# [F-048] Facturación Electrónica SUNAT (CPE)

- **Estado:** BORRADOR (se detalla al llegar a la Fase 4)
- **Autor:** Plan Maestro SDD
- **Fecha:** 2026-08-05
- **Módulos afectados:** `billing` (nuevo), `finance`
- **Migración asignada:** 048
- **Depende de:** F-046 Finance (un CPE es la formalización tributaria de un
  documento por cobrar)

## 1. Problema

Para competir con Odoo/SAP en Perú, la facturación electrónica (CPE: facturas,
boletas, notas de crédito/débito en UBL 2.1 firmadas digitalmente) es un
requisito de mercado, no un lujo. Es a la vez el mayor **foso competitivo** del
producto (Odoo genérico no lo resuelve bien) y el de mayor riesgo regulatorio.

## 2. Decisión estratégica: vía OSE/PSE primero

| Alternativa | Pros | Contras |
|---|---|---|
| Integración directa SUNAT (firmar XML UBL 2.1, CDR, certificado propio) | Sin costo por comprobante; control total | Complejidad alta: firma digital, homologación, contingencias, cambios normativos |
| **Vía OSE/PSE (API de proveedor autorizado)** ✅ | Time-to-market en semanas; el proveedor absorbe firma, validación y cambios normativos; API REST simple | Costo por comprobante; dependencia de tercero |

**Recomendación:** diseñar una interfaz interna `CpeProvider` (`emitir`,
`consultar_estado`, `anular`) con una primera implementación sobre un PSE. Si el
volumen algún día justifica la integración directa, se implementa la misma
interfaz sin tocar el resto del sistema.

## 3. Historias de usuario (esbozo)

- **HU-1:** Como Tesorería, quiero emitir una factura/boleta desde un documento
  por cobrar de Finance, para cumplir con SUNAT sin recapturar datos.
  - **CA-1.1:** DADO un documento por cobrar con cliente que tiene RUC/DNI válido,
    CUANDO emito el CPE, ENTONCES el sistema envía al PSE y guarda el estado
    resultante (`ENVIADO`) con su serie y correlativo.
  - **CA-1.2:** DADO un CPE aceptado por SUNAT, ENTONCES su estado pasa a
    `ACEPTADO` y el CDR/respuesta queda archivado.
- **HU-2:** Como Tesorería, quiero anular un comprobante mediante nota de crédito,
  para corregir errores conforme a norma.
  - **CA-2.1:** DADO un CPE `ACEPTADO`, CUANDO lo anulo, ENTONCES se genera una
    **nota de crédito** (no se edita el original).

## 4. Alcance de la primera iteración

- **Incluye:** emisión de **factura y boleta** desde un documento por cobrar de
  Finance (datos ya existen); estados
  `BORRADOR → ENVIADO → ACEPTADO / RECHAZADO / ANULADO` con CDR archivado; nota
  de crédito por anulación total; series y correlativos con `doc_sequences`;
  almacén de XML/PDF en Supabase Storage (obligación legal de conservación).
- **NO incluye (v1):** guías de remisión electrónicas, retenciones/percepciones,
  resumen diario de boletas, comunicación de baja masiva.

## 5. Reglas de negocio

- **RN-01 (regla de oro tributaria):** el sistema **jamás** permite editar un CPE
  `ACEPTADO`; toda corrección es una nota de crédito/débito. Esta invariante vive
  en el esquema (estado `ACEPTADO` inmutable por diseño de servicio + test dedicado),
  no en la buena voluntad del código.
- **RN-02:** todo XML/PDF emitido se conserva (Supabase Storage) por el plazo legal.
- **RN-03:** el `CpeProvider` es una interfaz; el proveedor concreto se inyecta
  por configuración (permite cambiar de PSE sin tocar negocio).

## 6. Impacto RBAC

- Permisos nuevos: `billing:emit`, `billing:void`, `billing:view`.

## 7. Preguntas abiertas

- [ ] **P1:** ¿qué PSE? (Nubefact, Efact, SUNAT-OSE, etc.) → evaluar costo/API en Fase 4.
- [ ] **P2:** ¿homologación previa requerida por el PSE elegido? → confirmar antes de T-01.

## 8. Métricas de éxito

Primer comprobante aceptado end-to-end en el entorno de pruebas del PSE.

---

## Checklist /speckit-verify

- [ ] RN-01 (CPE aceptado inmutable) cubierto por test dedicado.
- [ ] Emisión factura + boleta + nota de crédito probada en entorno beta del PSE.
- [ ] XML/PDF archivados en Storage.
- [ ] Series y correlativos sin colisión (test de concurrencia).
