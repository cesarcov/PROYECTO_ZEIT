"""
seed_full_erp.py — Carga masiva de datos de prueba para validar el ERP completo.

Crea:
  - 5  usuarios con roles reales
  - 10 clientes peruanos con RUC
  - 100 materiales eléctricos/mecánicos (estado ACTIVO, validación APPROVED)
  - 5  cotizaciones (project_plans + presupuesto_config) vinculadas a clientes

Uso:
    cd d:/PROYECTOS/ERP_MODULO/erp-modular
    python scripts/seed_full_erp.py
"""

import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import db_connection
from app.core.security.hashing import hash_password

# ─── CONFIGURACIÓN ───────────────────────────────────────────────────────────

PRINT_SUMMARY = True   # False = silencioso

# ─── DATOS: 5 USUARIOS ───────────────────────────────────────────────────────

NUEVOS_USUARIOS = [
    {
        "username": "sofia_mendoza",
        "email": "sofia.mendoza@ceshark.com",
        "password": "Demo2024!",
        "roles": ["Ingeniero de Campo"],
    },
    {
        "username": "rodrigo_vargas",
        "email": "rodrigo.vargas@ceshark.com",
        "password": "Demo2024!",
        "roles": ["Coordinador Logístico"],
    },
    {
        "username": "luciana_torres",
        "email": "luciana.torres@ceshark.com",
        "password": "Demo2024!",
        "roles": ["Asistente Administrativo"],
    },
    {
        "username": "andres_quispe",
        "email": "andres.quispe@ceshark.com",
        "password": "Demo2024!",
        "roles": ["Supervisor de Operaciones"],
    },
    {
        "username": "patricia_lima",
        "email": "patricia.lima@ceshark.com",
        "password": "Demo2024!",
        "roles": ["Ingeniero de Campo"],
    },
]

# ─── DATOS: 10 CLIENTES ──────────────────────────────────────────────────────

CLIENTES = [
    {
        "razon_social": "Minera Antamina S.A.C.",
        "ruc": "20372783927",
        "direccion": "Av. El Derby 254, Chorrillos, Lima",
        "telefono": "01-215-2000",
        "email": "contacto@antamina.com",
        "contacto": "Ing. Roberto Sánchez",
        "cargo_contacto": "Gerente de Proyectos",
        "notas": "Cliente premium. Proyectos de alta tensión y subestaciones.",
    },
    {
        "razon_social": "Construcciones Pacífico S.R.L.",
        "ruc": "20456789012",
        "direccion": "Jr. Los Pinos 340, Miraflores, Lima",
        "telefono": "01-446-7890",
        "email": "obras@construpacifico.pe",
        "contacto": "Arq. Carmen Ríos",
        "cargo_contacto": "Jefa de Obras",
        "notas": "Proyectos de construcción civil e instalaciones eléctricas.",
    },
    {
        "razon_social": "Electro Sur Este S.A.A.",
        "ruc": "20116544289",
        "direccion": "Av. Micaela Bastidas 310, Wanchaq, Cusco",
        "telefono": "084-231-521",
        "email": "proyectos@electrosureste.com.pe",
        "contacto": "Ing. Marco Huanca",
        "cargo_contacto": "Subgerente Técnico",
        "notas": "Concesionaria eléctrica. Proyectos de distribución y mantenimiento.",
    },
    {
        "razon_social": "Servicios Industriales del Norte S.A.C.",
        "ruc": "20481523456",
        "direccion": "Calle Las Magnolias 450, Trujillo, La Libertad",
        "telefono": "044-295-600",
        "email": "gerencia@sernorte.pe",
        "contacto": "Ing. Luis Castillo",
        "cargo_contacto": "Director Técnico",
        "notas": "Mantenimiento de plantas industriales en el norte del país.",
    },
    {
        "razon_social": "Montajes y Servicios Unidos S.A.C.",
        "ruc": "20523698741",
        "direccion": "Parque Industrial Villa El Salvador Mz. D, Lima",
        "telefono": "01-287-4500",
        "email": "licitaciones@monteserv.pe",
        "contacto": "Sr. Jorge Huamán",
        "cargo_contacto": "Gerente General",
        "notas": "Montaje electromecánico y estructuras metálicas.",
    },
    {
        "razon_social": "TASA - Tecnológica de Alimentos S.A.",
        "ruc": "20100199743",
        "direccion": "Calle Centenario 156, La Molina, Lima",
        "telefono": "01-317-0600",
        "email": "proyectos@tasa.com.pe",
        "contacto": "Ing. Ana Flores",
        "cargo_contacto": "Jefa de Mantenimiento",
        "notas": "Industria pesquera. Plantas en Paita, Chicama y Callao.",
    },
    {
        "razon_social": "Agro Industrial San Jacinto S.A.A.",
        "ruc": "20131803059",
        "direccion": "Km 28 Panamericana Norte, Nepeña, Ancash",
        "telefono": "043-426-500",
        "email": "mantenimiento@sanjacinto.com.pe",
        "contacto": "Ing. Pedro Vega",
        "cargo_contacto": "Superintendente de Mantenimiento",
        "notas": "Ingenio azucarero. Proyectos de automatización y control.",
    },
    {
        "razon_social": "Corporación Lindley S.A.",
        "ruc": "20100072751",
        "direccion": "Av. Naciones Unidas 1163, La Victoria, Lima",
        "telefono": "01-390-0000",
        "email": "proveedores@lindley.pe",
        "contacto": "Ing. Silvia Paredes",
        "cargo_contacto": "Gerente de Ingeniería",
        "notas": "Embotelladora Coca-Cola. Alta exigencia en uptime de equipos.",
    },
    {
        "razon_social": "Consorcio Constructor Lima S.A.C.",
        "ruc": "20601234567",
        "direccion": "Av. Paseo de la República 5235, Miraflores, Lima",
        "telefono": "01-610-2200",
        "email": "ingenieria@conslima.pe",
        "contacto": "Ing. Carlos Mendoza",
        "cargo_contacto": "Gerente de Ingeniería",
        "notas": "Proyectos de edificios de oficinas y centros comerciales.",
    },
    {
        "razon_social": "Sociedad Minera Cerro Verde S.A.A.",
        "ruc": "20170040938",
        "direccion": "Av. Alfonso Ugarte 235, Arequipa",
        "telefono": "054-283-800",
        "email": "contratos@cerroverde.com.pe",
        "contacto": "Ing. Pablo Zúñiga",
        "cargo_contacto": "Superintendent Projects",
        "notas": "Minería de cobre. Proyectos de alta complejidad y largo plazo.",
    },
]

# ─── DATOS: 100 MATERIALES ───────────────────────────────────────────────────

MATERIALES = [
    # HERRAMIENTAS ELÉCTRICAS (15)
    ("HE-001", "Taladro percutor eléctrico 1/2\"", "Herramienta", 485.00, 5),
    ("HE-002", "Taladro inalámbrico 18V Li-Ion", "Herramienta", 620.00, 5),
    ("HE-003", "Amoladora angular 4.5\" 850W", "Herramienta", 220.00, 5),
    ("HE-004", "Amoladora angular 7\" 2000W", "Herramienta", 380.00, 3),
    ("HE-005", "Soldadora MIG 160A 220V", "Herramienta", 1850.00, 2),
    ("HE-006", "Soldadora STICK 200A", "Herramienta", 980.00, 2),
    ("HE-007", "Sierra circular eléctrica 7.25\" 1400W", "Herramienta", 420.00, 3),
    ("HE-008", "Sierra caladora eléctrica 700W", "Herramienta", 310.00, 3),
    ("HE-009", "Lijadora orbital 5\" 300W", "Herramienta", 185.00, 3),
    ("HE-010", "Atornillador inalámbrico 12V", "Herramienta", 280.00, 5),
    ("HE-011", "Rotomartillo SDS Plus 800W", "Herramienta", 650.00, 3),
    ("HE-012", "Martillo demoledor 1500W SDS Max", "Herramienta", 1450.00, 2),
    ("HE-013", "Esmeril de banco 6\" 400W", "Herramienta", 360.00, 2),
    ("HE-014", "Taladro de columna 16\" 550W", "Herramienta", 890.00, 1),
    ("HE-015", "Pistola de calor 2000W 650°C", "Herramienta", 195.00, 5),
    # TUBERÍAS Y CONDUIT (15)
    ("TC-001", "Tubería conduit EMT 3/4\" x 3m", "Material", 18.50, 20),
    ("TC-002", "Tubería conduit EMT 1\" x 3m", "Material", 26.00, 20),
    ("TC-003", "Tubería conduit EMT 2\" x 3m", "Material", 58.00, 15),
    ("TC-004", "Tubería conduit PVC 3/4\" x 3m", "Material", 8.50, 30),
    ("TC-005", "Tubería conduit PVC 1\" x 3m", "Material", 12.00, 30),
    ("TC-006", "Tubería conduit PVC 2\" x 3m", "Material", 24.00, 20),
    ("TC-007", "Curva EMT 90° 3/4\"", "Material", 4.50, 50),
    ("TC-008", "Curva EMT 90° 1\"", "Material", 7.00, 50),
    ("TC-009", "Cupón EMT 3/4\"", "Material", 2.80, 100),
    ("TC-010", "Cupón EMT 1\"", "Material", 4.20, 80),
    ("TC-011", "Conector recto EMT 3/4\"", "Material", 1.90, 100),
    ("TC-012", "Conector recto EMT 1\"", "Material", 2.80, 80),
    ("TC-013", "Caja octogonal galvanizada 4\"", "Material", 3.50, 50),
    ("TC-014", "Caja rectangular galvanizada 4\"x2\"", "Material", 4.20, 50),
    ("TC-015", "Caja cuadrada galvanizada 4\"x4\"", "Material", 5.80, 30),
    # CABLES ELÉCTRICOS (15)
    ("CA-001", "Cable THW 2.5mm² color negro x100m", "Material", 85.00, 10),
    ("CA-002", "Cable THW 4mm² color negro x100m", "Material", 135.00, 10),
    ("CA-003", "Cable THW 6mm² color negro x100m", "Material", 198.00, 8),
    ("CA-004", "Cable THW 10mm² color negro x100m", "Material", 320.00, 5),
    ("CA-005", "Cable THW 16mm² color negro x100m", "Material", 495.00, 5),
    ("CA-006", "Cable NYY 2x2.5mm² x100m", "Material", 185.00, 5),
    ("CA-007", "Cable NYY 3x4mm² x100m", "Material", 310.00, 5),
    ("CA-008", "Cable NYY 3x6mm² x100m", "Material", 460.00, 3),
    ("CA-009", "Cable flexible 2.5mm² rojo x100m", "Material", 90.00, 10),
    ("CA-010", "Cable flexible 4mm² rojo x100m", "Material", 140.00, 8),
    ("CA-011", "Cable apantallado 2x0.75mm² x100m", "Material", 125.00, 5),
    ("CA-012", "Cable coaxial RG-6 x100m", "Material", 95.00, 5),
    ("CA-013", "Cable UTP Cat6 x305m (bobina)", "Material", 245.00, 3),
    ("CA-014", "Cable de control 5x1.5mm² x100m", "Material", 210.00, 3),
    ("CA-015", "Cable de fibra óptica monomodo 4FO x100m", "Material", 380.00, 2),
    # TABLEROS Y EQUIPOS (15)
    ("TE-001", "Tablero eléctrico metálico 60x40x20cm", "Equipo", 320.00, 3),
    ("TE-002", "Tablero eléctrico metálico 80x60x25cm", "Equipo", 480.00, 2),
    ("TE-003", "Interruptor termomagnético 2x16A", "Material", 45.00, 20),
    ("TE-004", "Interruptor termomagnético 2x25A", "Material", 55.00, 20),
    ("TE-005", "Interruptor termomagnético 3x32A", "Material", 85.00, 15),
    ("TE-006", "Interruptor termomagnético 3x63A", "Material", 135.00, 10),
    ("TE-007", "Interruptor diferencial 2x25A 30mA", "Material", 165.00, 10),
    ("TE-008", "Interruptor diferencial 4x40A 30mA", "Material", 245.00, 8),
    ("TE-009", "Contactor 3P 18A 220V AC", "Material", 95.00, 10),
    ("TE-010", "Contactor 3P 40A 220V AC", "Material", 145.00, 8),
    ("TE-011", "Relé térmico 12-18A", "Material", 75.00, 10),
    ("TE-012", "Relé térmico 25-40A", "Material", 95.00, 8),
    ("TE-013", "Variador de frecuencia 1HP 220V", "Equipo", 480.00, 3),
    ("TE-014", "Variador de frecuencia 5HP 220V", "Equipo", 980.00, 2),
    ("TE-015", "PLC Siemens S7-1200 CPU 1214C", "Equipo", 2850.00, 1),
    # ILUMINACIÓN (10)
    ("IL-001", "Luminaria LED industrial 100W IP65", "Material", 185.00, 10),
    ("IL-002", "Luminaria LED industrial 200W IP65", "Material", 320.00, 8),
    ("IL-003", "Luminaria LED panel 60x60cm 40W", "Material", 95.00, 15),
    ("IL-004", "Luminaria LED tubo T8 18W x1.2m", "Material", 28.00, 30),
    ("IL-005", "Foco LED 12W E27 luz fría", "Material", 8.50, 50),
    ("IL-006", "Reflector LED 50W exterior IP66", "Material", 85.00, 10),
    ("IL-007", "Reflector LED 100W exterior IP66", "Material", 145.00, 8),
    ("IL-008", "Luminaria de emergencia 8W 2h", "Material", 65.00, 15),
    ("IL-009", "Señalética de emergencia LED 5W", "Material", 45.00, 20),
    ("IL-010", "Detector de movimiento PIR 220V", "Material", 35.00, 20),
    # INSTRUMENTACIÓN (10)
    ("IN-001", "Multímetro digital Fluke 117", "Equipo", 650.00, 3),
    ("IN-002", "Pinza amperimétrica Fluke 376 FC", "Equipo", 980.00, 2),
    ("IN-003", "Megóhmetro 500V digital", "Equipo", 450.00, 2),
    ("IN-004", "Telurómetro digital 4 terminales", "Equipo", 1250.00, 1),
    ("IN-005", "Analizador de redes trifásico", "Equipo", 2850.00, 1),
    ("IN-006", "Cámara termográfica FLIR E8-XT", "Equipo", 4500.00, 1),
    ("IN-007", "Vibrómetro portátil digital", "Equipo", 780.00, 2),
    ("IN-008", "Luxómetro digital calibrado", "Equipo", 320.00, 2),
    ("IN-009", "Sensor de temperatura PT100", "Material", 85.00, 10),
    ("IN-010", "Transmisor de presión 4-20mA 0-10bar", "Equipo", 380.00, 5),
    # CONSUMIBLES Y SEGURIDAD (10)
    ("CS-001", "Guantes dieléctricos clase 0 1000V", "Consumible", 85.00, 10),
    ("CS-002", "Guantes dieléctricos clase 2 17000V", "Consumible", 285.00, 5),
    ("CS-003", "Casco de seguridad dieléctrico", "Consumible", 45.00, 10),
    ("CS-004", "Lentes de seguridad policarbonato", "Consumible", 12.00, 20),
    ("CS-005", "Arnés de seguridad 2 puntos de anclaje", "Consumible", 185.00, 5),
    ("CS-006", "Línea de vida doble shock absorber 1.8m", "Consumible", 145.00, 5),
    ("CS-007", "Conos de señalización vial 70cm naranja", "Consumible", 18.00, 20),
    ("CS-008", "Cinta de señalización peligro x100m", "Consumible", 8.50, 10),
    ("CS-009", "Extintor PQS 6kg ABC certificado", "Consumible", 85.00, 5),
    ("CS-010", "Kit de primeros auxilios industrial", "Consumible", 120.00, 3),
    # MECÁNICO Y ESTRUCTURA (10)
    ("ME-001", "Perfil angular 1/8\" x 1 1/2\" x 6m", "Material", 45.00, 20),
    ("ME-002", "Perfil angular 3/16\" x 2\" x 6m", "Material", 85.00, 15),
    ("ME-003", "Platina de acero 1/4\" x 2\" x 6m", "Material", 120.00, 10),
    ("ME-004", "Tubo cuadrado 1\" x 1.5mm x 6m", "Material", 65.00, 15),
    ("ME-005", "Tubo rectangular 2\"x1\" x 1.5mm x 6m", "Material", 78.00, 12),
    ("ME-006", "Perno hexagonal A307 1/2\"x2\" galv c/tuerca", "Material", 1.20, 500),
    ("ME-007", "Perno hexagonal A307 3/8\"x1.5\" galv c/tuerca", "Material", 0.85, 500),
    ("ME-008", "Arandela plana 1/2\" galvanizada", "Material", 0.30, 1000),
    ("ME-009", "Electrodo de soldadura E6011 3/32\" x kg", "Consumible", 18.50, 30),
    ("ME-010", "Electrodo de soldadura E7018 1/8\" x kg", "Consumible", 22.00, 30),
]

# ─── DATOS: 5 COTIZACIONES ───────────────────────────────────────────────────

COTIZACIONES = [
    {
        "custom_project_name": "Instalación Eléctrica Industrial - Planta Antamina",
        "notes": "Proyecto de instalación de tableros MT/BT y canalización para ampliación de planta concentradora.",
        "cliente_idx": 0,  # Minera Antamina
        "gastos_generales_pct": 12.0,
        "utilidad_pct": 15.0,
        "igv_pct": 18.0,
        "moneda": "USD",
        "lugar_trabajo": "Antamina, Ancash",
        "plazo_dias": 120,
        "validez_dias": 30,
        "notas_config": "Trabajo en altura. Se requiere certificación IPERC.",
    },
    {
        "custom_project_name": "Mantenimiento Preventivo Anual - Electro Sur Este",
        "notes": "Servicio de mantenimiento preventivo de subestaciones de distribución y líneas MT en la región Cusco.",
        "cliente_idx": 2,  # Electro Sur Este
        "gastos_generales_pct": 10.0,
        "utilidad_pct": 12.0,
        "igv_pct": 18.0,
        "moneda": "PEN",
        "lugar_trabajo": "Cusco, Puno, Madre de Dios",
        "plazo_dias": 90,
        "validez_dias": 45,
        "notas_config": "Trabajo en zonas remotas. Incluye viáticos y movilidad.",
    },
    {
        "custom_project_name": "Automatización Línea de Producción - TASA Paita",
        "notes": "Implementación de sistema SCADA y PLC Siemens para control automatizado de línea de enlatado.",
        "cliente_idx": 5,  # TASA
        "gastos_generales_pct": 14.0,
        "utilidad_pct": 18.0,
        "igv_pct": 18.0,
        "moneda": "USD",
        "lugar_trabajo": "Paita, Piura",
        "plazo_dias": 60,
        "validez_dias": 30,
        "notas_config": "Ambiente marino. Equipos deben tener protección IP66 mínimo.",
    },
    {
        "custom_project_name": "Montaje Estructura Metálica - Consorcio Lima",
        "notes": "Suministro y montaje de estructura metálica para techado de patio de maniobras en edificio corporativo.",
        "cliente_idx": 8,  # Consorcio Constructor Lima
        "gastos_generales_pct": 10.0,
        "utilidad_pct": 14.0,
        "igv_pct": 18.0,
        "moneda": "PEN",
        "lugar_trabajo": "Miraflores, Lima",
        "plazo_dias": 45,
        "validez_dias": 20,
        "notas_config": "Trabajo en altura urbana. Requiere seguro SCTR.",
    },
    {
        "custom_project_name": "Sistema de Redes e Iluminación - Corporación Lindley",
        "notes": "Instalación de red eléctrica, iluminación LED industrial y red de datos en nueva planta embotelladora.",
        "cliente_idx": 7,  # Corporación Lindley
        "gastos_generales_pct": 11.0,
        "utilidad_pct": 13.0,
        "igv_pct": 18.0,
        "moneda": "PEN",
        "lugar_trabajo": "La Victoria, Lima",
        "plazo_dias": 75,
        "validez_dias": 30,
        "notas_config": "Planta en operación. Trabajos nocturnos y fines de semana.",
    },
]


# ─── HELPERS ─────────────────────────────────────────────────────────────────

def log(msg: str):
    if PRINT_SUMMARY:
        print(msg)


def _gen_numero_cotizacion(cur, year: int) -> str:
    cur.execute(
        "SELECT COUNT(*) FROM presupuesto_config WHERE numero_cotizacion LIKE %s",
        (f"COT-{year}-%",)
    )
    seq = cur.fetchone()[0] + 1
    return f"COT-{year}-{seq:04d}"


def _gen_cliente_code(cur, year: int) -> str:
    cur.execute(
        "SELECT COUNT(*) FROM clientes WHERE codigo LIKE %s",
        (f"CLI-{year}-%",)
    )
    seq = cur.fetchone()[0] + 1
    return f"CLI-{year}-{seq:04d}"


# ─── SEED FUNCTIONS ──────────────────────────────────────────────────────────

def seed_usuarios(conn) -> dict[str, str]:
    """Crea (o actualiza) los 5 usuarios. Retorna {username: user_id}."""
    result = {}

    with conn.cursor() as cur:
        for u in NUEVOS_USUARIOS:
            hashed = hash_password(u["password"])
            cur.execute("SELECT id FROM users WHERE username = %s", (u["username"],))
            row = cur.fetchone()
            if row:
                user_id = str(row[0])
                cur.execute(
                    "UPDATE users SET email=%s, hashed_password=%s, is_active=TRUE WHERE id=%s",
                    (u["email"], hashed, user_id)
                )
                log(f"  [USERS] Actualizado : {u['username']}")
            else:
                cur.execute(
                    "INSERT INTO users (username, email, hashed_password, is_active) "
                    "VALUES (%s, %s, %s, TRUE) RETURNING id",
                    (u["username"], u["email"], hashed)
                )
                user_id = str(cur.fetchone()[0])
                log(f"  [USERS] Creado      : {u['username']}")

            # Asignar roles
            cur.execute("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
            for role_name in u["roles"]:
                cur.execute("SELECT id FROM roles WHERE name = %s", (role_name,))
                role_row = cur.fetchone()
                if not role_row:
                    log(f"           WARN: Rol no encontrado: {role_name}")
                    continue
                cur.execute(
                    "INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (user_id, str(role_row[0]))
                )

            result[u["username"]] = user_id

    conn.commit()
    log(f"\n  OK: {len(result)} usuarios procesados.")
    return result


def seed_clientes(conn) -> list[str]:
    """Crea (o actualiza) los 10 clientes. Retorna lista de IDs en el mismo orden."""
    ids = []
    year = datetime.now().year

    with conn.cursor() as cur:
        for c in CLIENTES:
            # Buscar por RUC primero, luego por razón social
            cur.execute("SELECT id FROM clientes WHERE ruc = %s", (c["ruc"],))
            row = cur.fetchone()
            if not row:
                cur.execute("SELECT id FROM clientes WHERE razon_social = %s", (c["razon_social"],))
                row = cur.fetchone()

            if row:
                cliente_id = str(row[0])
                cur.execute("""
                    UPDATE clientes
                    SET razon_social=%s, ruc=%s, direccion=%s, telefono=%s,
                        email=%s, contacto=%s, cargo_contacto=%s, notas=%s, activo=TRUE
                    WHERE id=%s
                """, (
                    c["razon_social"], c["ruc"], c["direccion"], c["telefono"],
                    c["email"], c["contacto"], c["cargo_contacto"], c["notas"],
                    cliente_id
                ))
                log(f"  [CLIENTES] Actualizado: {c['razon_social'][:45]}")
            else:
                codigo = _gen_cliente_code(cur, year)
                cur.execute("""
                    INSERT INTO clientes
                        (codigo, razon_social, ruc, direccion, telefono,
                         email, contacto, cargo_contacto, notas, activo)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE)
                    RETURNING id
                """, (
                    codigo,
                    c["razon_social"], c["ruc"], c["direccion"], c["telefono"],
                    c["email"], c["contacto"], c["cargo_contacto"], c["notas"]
                ))
                cliente_id = str(cur.fetchone()[0])
                log(f"  [CLIENTES] Creado ({codigo}): {c['razon_social'][:40]}")

            ids.append(cliente_id)

    conn.commit()
    log(f"\n  OK: {len(ids)} clientes procesados.")
    return ids


def seed_materiales(conn) -> list[str]:
    """Inserta los 100 materiales (skip si el código ya existe). Retorna IDs creados."""
    ids = []
    skipped = 0

    with conn.cursor() as cur:
        for code, name, category, unit_cost, min_stock in MATERIALES:
            cur.execute("SELECT id FROM materials WHERE code = %s", (code,))
            row = cur.fetchone()
            if row:
                ids.append(str(row[0]))
                skipped += 1
                continue

            cur.execute("""
                INSERT INTO materials (
                    name, code, min_stock, category, unit_cost,
                    validation_status, estado
                ) VALUES (%s, %s, %s, %s, %s, 'APPROVED', 'ACTIVO')
                RETURNING id
            """, (name, code, min_stock, category, unit_cost))
            mat_id = str(cur.fetchone()[0])
            ids.append(mat_id)

    conn.commit()
    created = len(ids) - skipped
    log(f"\n  OK: {created} materiales creados, {skipped} ya existian. Total: {len(ids)}.")
    return ids


def seed_cotizaciones(conn, cliente_ids: list[str], engineer_id: str) -> list[str]:
    """Crea 5 project_plans + presupuesto_config. Retorna lista de plan_ids."""
    plan_ids = []
    year = datetime.now().year

    with conn.cursor() as cur:
        for _i, cot in enumerate(COTIZACIONES):
            # Contar planes existentes este año
            cur.execute(
                "SELECT COUNT(*) FROM project_plans WHERE EXTRACT(YEAR FROM created_at)=%s",
                (year,)
            )
            count = cur.fetchone()[0]
            project_code = f"PRO-{year}-{(count + 1):04d}"

            cliente_id = cliente_ids[cot["cliente_idx"]] if cot["cliente_idx"] < len(cliente_ids) else None

            # Insertar plan
            cur.execute("""
                INSERT INTO project_plans
                    (engineer_id, title, notes, status, custom_project_name, project_code)
                VALUES (%s, %s, %s, 'DRAFT', %s, %s)
                RETURNING id
            """, (
                engineer_id,
                cot["custom_project_name"],
                cot["notes"],
                cot["custom_project_name"],
                project_code,
            ))
            plan_id = str(cur.fetchone()[0])

            # Generar número de cotización
            numero = _gen_numero_cotizacion(cur, year)

            # Obtener razón social y RUC del cliente
            cliente_nombre = None
            cliente_ruc = None
            if cliente_id:
                cur.execute(
                    "SELECT razon_social, ruc FROM clientes WHERE id=%s", (cliente_id,)
                )
                cl_row = cur.fetchone()
                if cl_row:
                    cliente_nombre, cliente_ruc = cl_row[0], cl_row[1]

            # Crear presupuesto_config
            cur.execute("""
                INSERT INTO presupuesto_config (
                    plan_id, numero_cotizacion,
                    gastos_generales_pct, utilidad_pct, igv_pct,
                    moneda, cliente_id, cliente_nombre, cliente_ruc,
                    lugar_trabajo, plazo_dias, validez_dias,
                    notas, notas_comerciales, status
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'DRAFT'
                )
            """, (
                plan_id, numero,
                cot["gastos_generales_pct"], cot["utilidad_pct"], cot["igv_pct"],
                cot["moneda"], cliente_id, cliente_nombre, cliente_ruc,
                cot["lugar_trabajo"], cot["plazo_dias"], cot["validez_dias"],
                cot["notes"], cot["notas_config"],
            ))

            plan_ids.append(plan_id)
            log(f"  [COTIZ] {numero} — {cot['custom_project_name'][:50]}")

    conn.commit()
    log(f"\n  OK: {len(plan_ids)} cotizaciones creadas.")
    return plan_ids


# ─── MAIN ────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "=" * 65)
    print("  SEED FULL ERP - Carga masiva de datos de validacion")
    print("=" * 65)

    with db_connection() as conn:

        # Buscar un ingeniero existente para asignar a cotizaciones
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                JOIN roles r ON r.id = ur.role_id
                WHERE r.name ILIKE '%ingeniero%' AND u.is_active = TRUE
                LIMIT 1
            """)
            row = cur.fetchone()
            engineer_id = str(row[0]) if row else None

        if not engineer_id:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM users WHERE is_active=TRUE LIMIT 1")
                row = cur.fetchone()
                engineer_id = str(row[0]) if row else None

        if not engineer_id:
            print("\n  ERROR: No hay usuarios activos en la BD. Ejecuta seed_users.py primero.")
            sys.exit(1)

        print(f"\n  Engineer ID para cotizaciones: {engineer_id}\n")

        # 1. Usuarios
        print("-- 1/4  USUARIOS " + "-" * 48)
        user_ids = seed_usuarios(conn)

        sofia_id = user_ids.get("sofia_mendoza") or user_ids.get("patricia_lima")
        if sofia_id:
            engineer_id = sofia_id

        # 2. Clientes
        print("\n-- 2/4  CLIENTES " + "-" * 48)
        cliente_ids = seed_clientes(conn)

        # 3. Materiales
        print("\n-- 3/4  MATERIALES " + "-" * 46)
        material_ids = seed_materiales(conn)

        # 4. Cotizaciones
        print("\n-- 4/4  COTIZACIONES " + "-" * 44)
        plan_ids = seed_cotizaciones(conn, cliente_ids, engineer_id)

    print("\n" + "=" * 65)
    print("  RESUMEN FINAL")
    print("=" * 65)
    print(f"  Usuarios procesados : {len(user_ids)}")
    print(f"  Clientes insertados : {len(cliente_ids)}")
    print(f"  Materiales totales  : {len(material_ids)}")
    print(f"  Cotizaciones creadas: {len(plan_ids)}")
    print("\n  Credenciales nuevos usuarios:")
    for u in NUEVOS_USUARIOS:
        print(f"    {u['username']:20s}  pwd: {u['password']}  rol: {', '.join(u['roles'])}")
    print("\n  OK - Seed completado. El ERP esta listo para validacion.\n")


if __name__ == "__main__":
    main()
