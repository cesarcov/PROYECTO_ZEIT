# [F-001] Lanzamiento por fases — Logística primero

- **Estado:** IMPLEMENTADA
- **Autor:** Cesar Huamani (dirección) · Claude Code (ejecución)
- **Fecha:** 2026-10-06
- **Módulos afectados:** transversal (core, auth, frontend/Layout)
- **Migración asignada:** ninguna — todo se controla por variable de entorno

## 1. Problema

El ERP tiene 17 módulos en producción, pero sólo Logística está pulida. Los
demás funcionan a medias: se usan como maqueta de lo que vendrá, no como
producto. Mostrarlos a los usuarios reales tiene dos costes:

1. **Erosiona la confianza.** Un módulo que falla enseña al usuario a
   desconfiar de todo el sistema, incluido lo que sí funciona.
2. **Genera soporte caro.** Cada pantalla a medias produce preguntas,
   reportes de bugs conocidos y expectativas que nadie va a cumplir pronto.

Hace falta poder seguir desarrollando los 16 módulos restantes **en
producción, sobre datos reales**, sin que nadie más que el desarrollador los
vea.

## 2. Objetivos verificables

- **OBJ-1:** Un usuario normal no puede ver ni usar un módulo sin soltar, ni
  por el menú ni escribiendo la URL ni llamando al API directamente.
- **OBJ-2:** El desarrollador sí puede usarlos, en el mismo entorno de
  producción y con los mismos datos.
- **OBJ-3:** Soltar un módulo al público no requiere tocar código ni base de
  datos: se cambia una variable de entorno y se redesplega.
- **OBJ-4:** Un endpoint nuevo dentro de un módulo sin soltar queda cerrado
  automáticamente, sin que nadie tenga que acordarse de marcarlo.
- **OBJ-5:** Logística, Administración y Solicitudes no se pueden cerrar por
  accidente.

## 3. Alcance

- **Soltado al público:** Logística, Administración (usuarios, roles,
  auditoría, marca), Solicitudes de material, Perfil y Preferencias.
- **En beta (sólo el desarrollador):** Operaciones, Cotizaciones, Compras,
  Clientes, Canal, Gerencia, Planificación, Requerimientos.
- **NO incluye:** borrar código de los módulos en beta; cambiar permisos RBAC;
  pulir ningún módulo. Esto sólo controla quién los ve.

## 4. Reglas / decisiones

- **RN-01:** La unidad de control es el **ÁREA**, no el módulo del sidebar.
  Los módulos no están separados limpiamente: el menú de Logística enlaza a
  `/compras` y `/canal`, y el de Admin a `/planificacion` y `/clientes`.
  Controlar por módulo dejaría enlaces muertos dentro de áreas públicas.
- **RN-02:** El cierre se decide en **un único middleware por prefijo de URL**,
  no endpoint por endpoint. Son ~200 endpoints: un punto único se verifica de
  un vistazo y cubre los endpoints futuros automáticamente (OBJ-4).
- **RN-03:** Un área cerrada responde **404, no 403**. Un 403 confirma que la
  ruta existe y que hay algo detrás; un 404 no cuenta nada de lo que aún no
  está listo.
- **RN-04:** Ser administrador **no** da acceso a la beta. Sólo los usuarios
  listados en `BETA_TESTERS`, más el superadmin. Si no, cualquier admin del
  cliente entraría a módulos a medias.
- **RN-05:** `logistica`, `admin` y `solicitudes` están en
  `AREAS_NO_CERRABLES`: si alguien las pone en `MODULOS_BETA`, se ignoran y se
  avisa. Cerrarlas dejaría el ERP inservible y sin forma de recuperarlo.
- **RN-06:** Un nombre de área mal escrito en `MODULOS_BETA` se **ignora y
  avisa**. El fallo peligroso es el silencioso: creer que un módulo está
  cerrado cuando una errata lo dejó abierto.

## 5. Impacto RBAC

Ninguno. No crea ni cambia permisos. El gate es una capa de **lanzamiento**,
no de autorización: un área pública sigue exigiendo exactamente los permisos
que exigía antes.

Nota: el `username` viaja ahora en el access token, para que el middleware
sepa si quien llama es beta tester sin consultar la base de datos en cada
petición. Los tokens emitidos antes de este cambio no lo llevan, así que un
beta tester con sesión vieja debe volver a entrar una vez.

## 6. Impacto en auditoría

Cada petición bloqueada se registra en los logs con su área, su ruta y el
usuario que la intentó. Útil para detectar un enlace muerto que se nos pasó,
o a alguien curioseando.

## 7. Métricas de éxito

- Un usuario de Logística no ve en su menú nada que no funcione.
- El desarrollador prueba Cotizaciones en producción el mismo día.
- Soltar Operaciones cuando esté lista = editar una variable en Render.

## 8. Cómo soltar un módulo al público

1. Pulirlo y probarlo (como beta tester, o en `staging`, donde
   `MODULOS_BETA` está vacío y todo está abierto).
2. En Render → *Environment* → quitar el área de `MODULOS_BETA`.
3. Guardar. Render redesplega solo.
4. Los usuarios ven el módulo aparecer en su menú al volver a entrar.

Para dar marcha atrás: volver a añadirlo a la lista. No hay migración que
revertir ni código que tocar.
