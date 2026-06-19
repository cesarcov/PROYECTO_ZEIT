"""Bulk insert 105 electrical materials into ALM-CENTRAL warehouse."""
import sys
import uuid
from datetime import datetime

sys.path.insert(0, ".")
from app.core.database import db_connection

WH_ID = "9ffccd97-fbd7-4d8a-b636-d68f5549dc74"
NOW = datetime.utcnow()

# (code, name, description, unit, category, unit_cost, min_stock, rack, level, box)
MATERIALS = [
    # HERRAMIENTAS ELECTRICAS
    ("HE-001", "Taladro percutor eléctrico 1/2 pulgada", "Taladro percutor 750W, chuck 1/2 pulgada, velocidad variable", "und", "Herramienta", 485.00, 5, "A", "1", "1"),
    ("HE-002", "Taladro inalámbrico 18V Li-Ion", "Incluye 2 baterías y cargador rápido", "und", "Herramienta", 620.00, 5, "A", "1", "2"),
    ("HE-003", "Amoladora angular 4.5 pulgadas 850W", "Disco de desbaste incluido, protector ajustable", "und", "Herramienta", 220.00, 5, "A", "1", "3"),
    ("HE-004", "Amoladora angular 7 pulgadas 2000W", "Para corte de metal y mampostería", "und", "Herramienta", 380.00, 3, "A", "1", "4"),
    ("HE-005", "Soldadora eléctrica MIG 160A", "Soldadura MIG/MAG, voltaje 220V, ciclo de trabajo 60%", "und", "Herramienta", 1850.00, 2, "A", "2", "1"),
    ("HE-006", "Soldadora eléctrica STICK 200A", "Electrodo revestido, entrada 220V monofásica", "und", "Herramienta", 980.00, 2, "A", "2", "2"),
    ("HE-007", "Sierra circular eléctrica 7.25 pulgadas", "1400W, corte máximo 55mm a 90 grados", "und", "Herramienta", 420.00, 3, "A", "2", "3"),
    ("HE-008", "Sierra caladora eléctrica 700W", "650W, velocidad variable, pendular 4 etapas", "und", "Herramienta", 310.00, 3, "A", "2", "4"),
    ("HE-009", "Lijadora orbital eléctrica 5 pulgadas", "300W, plato de 125mm, excéntrica", "und", "Herramienta", 185.00, 3, "A", "3", "1"),
    ("HE-010", "Atornillador inalámbrico 12V", "Par máx. 30Nm, incluye puntas Phillips y planas", "und", "Herramienta", 280.00, 5, "A", "3", "2"),
    ("HE-011", "Rotomartillo SDS Plus 800W", "800W, 3 modos: taladrar, percutor, cincelar", "und", "Herramienta", 650.00, 3, "A", "3", "3"),
    ("HE-012", "Martillo demoledor eléctrico 1500W", "Energía de impacto 45J, 1500W, SDS Max", "und", "Herramienta", 1450.00, 2, "A", "3", "4"),
    ("HE-013", "Esmeril de banco 6 pulgadas 400W", "Doble esmeril, muelas de óxido de aluminio", "und", "Herramienta", 360.00, 2, "A", "4", "1"),
    ("HE-014", "Taladro de columna 16 pulgadas 550W", "Mesa de trabajo 200x200mm, 5 velocidades", "und", "Herramienta", 890.00, 1, "A", "4", "2"),
    ("HE-015", "Pistola de calor 2000W", "Temperatura regulable 50-650°C, 2 velocidades", "und", "Herramienta", 195.00, 5, "A", "4", "3"),
    # TUBERIAS Y CONDUIT
    ("TC-001", "Tubería conduit EMT 3/4 pulgada x 3m", "Acero galvanizado, uso en instalaciones eléctricas", "und", "Material", 18.50, 20, "B", "1", "1"),
    ("TC-002", "Tubería conduit EMT 1 pulgada x 3m", "Acero galvanizado EMT, certificada NTP", "und", "Material", 26.00, 20, "B", "1", "2"),
    ("TC-003", "Tubería conduit EMT 2 pulgadas x 3m", "Acero galvanizado, para circuitos de fuerza", "und", "Material", 58.00, 15, "B", "1", "3"),
    ("TC-004", "Tubería conduit PVC 3/4 pulgada x 3m", "PVC rígido eléctrico, color gris, NTP", "und", "Material", 8.50, 30, "B", "1", "4"),
    ("TC-005", "Tubería conduit PVC 1 pulgada x 3m", "PVC rígido eléctrico, alta resistencia UV", "und", "Material", 12.00, 30, "B", "2", "1"),
    ("TC-006", "Tubería conduit PVC 2 pulgadas x 3m", "PVC rígido eléctrico, uso en circuitos troncales", "und", "Material", 24.00, 20, "B", "2", "2"),
    ("TC-007", "Curva conduit EMT 90 grados 3/4 pulgada", "Acero galvanizado, radio estándar", "und", "Material", 4.50, 50, "B", "2", "3"),
    ("TC-008", "Curva conduit EMT 90 grados 1 pulgada", "Acero galvanizado, instalación rápida", "und", "Material", 7.00, 50, "B", "2", "4"),
    ("TC-009", "Cupón conduit EMT 3/4 pulgada", "Acoplamiento metálico para unir tramos", "und", "Material", 2.80, 100, "B", "3", "1"),
    ("TC-010", "Cupón conduit EMT 1 pulgada", "Acoplamiento metálico para tramos de 1 pulgada", "und", "Material", 4.20, 80, "B", "3", "2"),
    ("TC-011", "Conector conduit recto 3/4 pulgada", "Conector metálico para tablero o caja de pase", "und", "Material", 3.50, 100, "B", "3", "3"),
    ("TC-012", "Conector conduit recto 1 pulgada", "Conector metálico 1 pulgada para caja o tablero", "und", "Material", 5.00, 80, "B", "3", "4"),
    # CABLES Y CONDUCTORES
    ("CA-001", "Cable THW 12 AWG negro rollo 100m", "Conductor de cobre, aislamiento termoplástico 75°C", "rollo", "Material", 185.00, 10, "C", "1", "1"),
    ("CA-002", "Cable THW 14 AWG blanco rollo 100m", "Conductor de cobre sólido, aislamiento 75°C", "rollo", "Material", 145.00, 10, "C", "1", "2"),
    ("CA-003", "Cable THW 10 AWG rojo rollo 100m", "Conductor flexible de cobre, aislamiento THW", "rollo", "Material", 260.00, 8, "C", "1", "3"),
    ("CA-004", "Cable LSZH 12 AWG rollo 100m", "Baja emisión de humos y cero halógenos", "rollo", "Material", 320.00, 5, "C", "1", "4"),
    ("CA-005", "Cable vulcanizado 2x12 AWG rollo 50m", "Doble aislamiento, uso en ambientes húmedos", "rollo", "Material", 210.00, 5, "C", "2", "1"),
    ("CA-006", "Cable vulcanizado 3x12 AWG rollo 50m", "Triple conductor, ideal para equipos portátiles", "rollo", "Material", 280.00, 5, "C", "2", "2"),
    ("CA-007", "Cable coaxial RG-6 rollo 100m", "75 Ohm, para sistemas CCTV y TV", "rollo", "Material", 120.00, 5, "C", "2", "3"),
    ("CA-008", "Cable UTP Cat6 rollo 100m", "Par trenzado sin apantallar, 550MHz", "rollo", "Material", 195.00, 5, "C", "2", "4"),
    ("CA-009", "Cable tierra desnudo 2.5mm cuadrado rollo 100m", "Cobre desnudo recocido, para sistemas de puesta a tierra", "rollo", "Material", 95.00, 8, "C", "3", "1"),
    ("CA-010", "Cable acero galvanizado 3/16 rollo 50m", "Para suspensión y soporte de bandejas portacables", "rollo", "Material", 85.00, 5, "C", "3", "2"),
    # EQUIPOS ELECTRICOS
    ("EQ-001", "Tablero eléctrico 12 circuitos", "Caja metálica empotrable, puerta con cerradura, barra de neutros", "und", "Equipo", 280.00, 5, "D", "1", "1"),
    ("EQ-002", "Tablero eléctrico 24 circuitos", "Caja metálica sobrepuesta, barra de neutros y tierra", "und", "Equipo", 520.00, 3, "D", "1", "2"),
    ("EQ-003", "Breaker termomagnético 1P 16A", "Interruptor automático riel DIN, capacidad ruptura 10kA", "und", "Equipo", 28.00, 20, "D", "1", "3"),
    ("EQ-004", "Breaker termomagnético 1P 20A", "Interruptor automático 1P 20A 10kA, riel DIN 35mm", "und", "Equipo", 30.00, 20, "D", "1", "4"),
    ("EQ-005", "Breaker termomagnético 2P 32A", "Interruptor automático 2P 32A, 10kA, bipolar", "und", "Equipo", 85.00, 10, "D", "2", "1"),
    ("EQ-006", "Breaker termomagnético 3P 63A", "Interruptor automático 3P 63A, para circuitos de fuerza", "und", "Equipo", 210.00, 5, "D", "2", "2"),
    ("EQ-007", "Contactor trifásico 25A 220V", "3P+NA, bobina 220V AC, para motores hasta 11kW", "und", "Equipo", 185.00, 5, "D", "2", "3"),
    ("EQ-008", "Contactor trifásico 40A 220V", "3P+NA+NC, bobina 220V, motores hasta 18.5kW", "und", "Equipo", 280.00, 3, "D", "2", "4"),
    ("EQ-009", "Relé térmico ajustable 10-16A", "Protección térmica para motor, riel DIN, manual/auto", "und", "Equipo", 95.00, 5, "D", "3", "1"),
    ("EQ-010", "Variador de frecuencia 5HP 220V", "VFD trifásico, 3.7kW, pantalla LCD, Modbus RTU", "und", "Equipo", 980.00, 2, "D", "3", "2"),
    ("EQ-011", "UPS 1500VA 900W onda senoidal", "Tiempo de respaldo 8-15 min, onda senoidal pura, USB", "und", "Equipo", 650.00, 2, "D", "3", "3"),
    ("EQ-012", "Generador eléctrico portátil 5.5KW", "Motor 4 tiempos, 420cc, monofásico 220V, AVR", "und", "Equipo", 2800.00, 1, "D", "3", "4"),
    ("EQ-013", "Transformador distribución 15KVA seco", "Trifásico seco 10kV/0.4kV, delta-estrella, clase F", "und", "Equipo", 8500.00, 1, "D", "4", "1"),
    ("EQ-014", "Banco de condensadores 50KVAR", "Corrección factor de potencia, 440V trifásico, automático", "und", "Equipo", 3200.00, 1, "D", "4", "2"),
    ("EQ-015", "Medidor de energía trifásico Modbus", "RS485 Modbus RTU, clase 1, 3x5-60A directo, LCD", "und", "Equipo", 420.00, 3, "D", "4", "3"),
    # EPPS
    ("EP-001", "Casco de seguridad dieléctrico clase E", "Clase E, resistencia 20kV, ajuste en rachet, ventilación", "und", "EPP", 45.00, 20, "E", "1", "1"),
    ("EP-002", "Guantes dieléctricos clase 0 1kV", "Par, látex natural, prueba 1000V AC, color beige", "par", "EPP", 185.00, 10, "E", "1", "2"),
    ("EP-003", "Guantes dieléctricos clase 2 17kV", "Par, látex natural, prueba 17000V AC, color amarillo", "par", "EPP", 380.00, 5, "E", "1", "3"),
    ("EP-004", "Botas dieléctricas con puntera de acero", "Aislamiento 18kV, suela antideslizante, talla 42", "par", "EPP", 220.00, 5, "E", "1", "4"),
    ("EP-005", "Arnés de seguridad full body 4 anillas", "Resistencia 2270kg, anillas dorsal y pectoral, certificado ANSI", "und", "EPP", 280.00, 5, "E", "2", "1"),
    ("EP-006", "Lentes de seguridad antiempañantes UV400", "Policarbonato, protección UV400, montura wraparound", "und", "EPP", 25.00, 30, "E", "2", "2"),
    ("EP-007", "Protector auditivo tipo copa NRR 25dB", "Estructura dieléctrica plegable, acolchado suave", "und", "EPP", 85.00, 15, "E", "2", "3"),
    ("EP-008", "Protector auditivo tapón desechable caja x50", "NRR 33dB, espuma de memoria, par individual empacado", "caja", "EPP", 35.00, 10, "E", "2", "4"),
    ("EP-009", "Mascarilla N95 con válvula caja x20", "Filtración mayor igual 95% partículas 0.3 micras, válvula exhalación", "caja", "EPP", 65.00, 10, "E", "3", "1"),
    ("EP-010", "Chaleco reflectivo alta visibilidad clase 2", "Clase 2 ANSI, bandas reflectivas plateadas, 3 bolsillos", "und", "EPP", 45.00, 20, "E", "3", "2"),
    ("EP-011", "Careta de soldar autooscurecente solar", "Solar y batería, DIN 9-13 ajustable, campo visual 98x43mm", "und", "EPP", 280.00, 5, "E", "3", "3"),
    ("EP-012", "Mangas para soldar de cuero par", "Par, cuero flor vacuno, resistencia hasta 300°C", "par", "EPP", 65.00, 10, "E", "3", "4"),
    ("EP-013", "Mandil de cuero completo para soldador", "Cuero flor completo, 60x90cm, ajustable", "und", "EPP", 95.00, 8, "E", "4", "1"),
    ("EP-014", "Zapato de seguridad punta de acero talla 42", "Puntera de acero 200J, suela PU/TR antideslizante", "par", "EPP", 185.00, 10, "E", "4", "2"),
    ("EP-015", "Guantes de badana talla L docena", "Cuero de badana, palma reforzada, uso general en campo", "docena", "EPP", 95.00, 5, "E", "4", "3"),
    # CONSUMIBLES ELECTRICOS
    ("CO-001", "Cinta aislante PVC 3/4 pulgada negra rollo 20m", "Voltaje 600V, temperatura -10 a 80°C, adhesivo acrílico", "rollo", "Consumible", 4.50, 50, "F", "1", "1"),
    ("CO-002", "Cinta autofusionante rollo 5m", "Para empalmes sumergidos, temperatura -54 a 260°C, self-fusing", "rollo", "Consumible", 18.00, 20, "F", "1", "2"),
    ("CO-003", "Terminal ojal 10mm cuadrado caja x100", "Pre-aislado, para conductor 10mm cuadrado, amarillo", "caja", "Consumible", 28.00, 20, "F", "1", "3"),
    ("CO-004", "Terminal punta preaislado 2.5mm cuadrado caja x100", "Rojo, para tornillo M3, conductor 2.5mm cuadrado", "caja", "Consumible", 15.00, 20, "F", "1", "4"),
    ("CO-005", "Prensacable nylon 3/4 pulgada IP68 bolsa x20", "Nylon 66, resistente a UV, negro, para conduit", "bolsa", "Consumible", 22.00, 15, "F", "2", "1"),
    ("CO-006", "Brida plástica 25cm bolsa x100 unidades", "Nylon 66, resistencia 20kg, negras UV estabilizadas", "bolsa", "Consumible", 12.00, 20, "F", "2", "2"),
    ("CO-007", "Amarre acero inoxidable 4.8mm bolsa x50", "304 SS, resistencia 80kg, uso en ambientes exteriores", "bolsa", "Consumible", 35.00, 10, "F", "2", "3"),
    ("CO-008", "Conector Wago 5 hilos 2.5mm cuadrado caja x50", "Conexión sin herramienta, resorte de tensión, transparente", "caja", "Consumible", 65.00, 10, "F", "2", "4"),
    ("CO-009", "Tubo termocontráctil 3/8 pulgada negro rollo 5m", "Relación 2:1, temperatura 150°C, poliolefina", "rollo", "Consumible", 18.00, 15, "F", "3", "1"),
    ("CO-010", "Tubo termocontráctil 3/4 pulgada negro rollo 5m", "Relación 2:1, adhesivo interno, IP67 al contraer", "rollo", "Consumible", 28.00, 10, "F", "3", "2"),
    ("CO-011", "Fusible NH tipo 00 125A unidad", "gG 125A 500V, para portafusibles NH00", "und", "Consumible", 45.00, 10, "F", "3", "3"),
    ("CO-012", "Fusible NH tipo 1 250A unidad", "gG 250A 500V, para portafusibles NH1", "und", "Consumible", 78.00, 8, "F", "3", "4"),
    ("CO-013", "Fusible vidrio 5x20mm 16A caja x10", "Rápido, 250V, uso en instrumentos y equipos electrónicos", "caja", "Consumible", 8.50, 20, "F", "4", "1"),
    ("CO-014", "Lubricante dieléctrico spray 400ml", "No conductor, protección contra corrosión y humedad", "und", "Consumible", 28.00, 10, "F", "4", "2"),
    ("CO-015", "Limpiador de contactos eléctricos spray 400ml", "Desengrasante de acción rápida, sin residuo, compatible con plásticos", "und", "Consumible", 32.00, 10, "F", "4", "3"),
    # ACCESORIOS ELECTRICOS
    ("AC-001", "Caja de pase metálica 4x4 pulgadas", "Acero galvanizado, 4 entradas knockouts, tapa incluida", "und", "Material", 12.00, 20, "G", "1", "1"),
    ("AC-002", "Caja de pase metálica 6x6 pulgadas", "Acero galvanizado pesado, soldada, con tapa con tornillos", "und", "Material", 22.00, 15, "G", "1", "2"),
    ("AC-003", "Tapa ciega metálica para caja 4x4 pulgadas", "Acero galvanizado, compatible con cajas de pase 4x4", "und", "Material", 5.00, 30, "G", "1", "3"),
    ("AC-004", "Tomacorriente bipolar 16A 220V industrial", "Schuko, IP44, uso industrial, color gris, montaje empotrado", "und", "Material", 32.00, 20, "G", "1", "4"),
    ("AC-005", "Tomacorriente trifásico 32A 380V IP67", "4P más T, IP67, rojo, montaje en superficie, CEE 17", "und", "Material", 125.00, 10, "G", "2", "1"),
    ("AC-006", "Interruptor simple 10A 250V", "Empotrable, tecla blanca, marco incluido, tipo americano", "und", "Material", 12.00, 30, "G", "2", "2"),
    ("AC-007", "Interruptor triple 10A 250V", "Empotrable, 3 teclas, para circuitos separados, marco incluido", "und", "Material", 28.00, 20, "G", "2", "3"),
    ("AC-008", "Placa ciega tipo americano", "Placa de cierre para cajas eléctricas, color blanco", "und", "Material", 4.50, 50, "G", "2", "4"),
    ("AC-009", "Portafusible NH tipo 00 riel DIN", "Para fusibles NH00 hasta 160A, montaje riel DIN, 500V", "und", "Material", 65.00, 10, "G", "3", "1"),
    ("AC-010", "Riel DIN 35mm x 1m TS35", "Acero galvanizado, TS35, para tableros de distribución", "und", "Material", 18.00, 20, "G", "3", "2"),
    ("AC-011", "Canaleta ranurada 40x40mm x 2m", "PVC gris, para organización de cables en tableros", "und", "Material", 25.00, 20, "G", "3", "3"),
    ("AC-012", "Canaleta ranurada 60x60mm x 2m", "PVC gris, mayor capacidad de cables, para tableros grandes", "und", "Material", 38.00, 15, "G", "3", "4"),
    ("AC-013", "Bandeja portacable perforada 150mm x 3m", "Acero galvanizado en caliente, carga 30kg por metro", "und", "Material", 85.00, 10, "G", "4", "1"),
    ("AC-014", "Soporte tipo L 40mm para bandeja caja x20", "Acero galvanizado, para bandejas hasta 150mm de ancho", "caja", "Material", 95.00, 5, "G", "4", "2"),
    ("AC-015", "Espiral organizador de cables 1/2 pulgada 5m", "Polietileno flexible, agrupa hasta 10 cables, negro UV", "und", "Material", 15.00, 20, "G", "4", "3"),
    # INSTRUMENTOS DE MEDICION
    ("IM-001", "Multímetro digital FLUKE 117 True-RMS", "True-RMS, CAT III 600V, detector de voltaje NCV integrado", "und", "Equipo", 680.00, 3, "H", "1", "1"),
    ("IM-002", "Pinza amperimétrica 400A AC/DC True-RMS", "True-RMS, CAT IV 300V, Bluetooth compatible, data logging", "und", "Equipo", 520.00, 3, "H", "1", "2"),
    ("IM-003", "Megóhmetro digital 1000V", "Medición aislamiento 0.01 mega-Ohm a 200 giga-Ohm, CAT IV", "und", "Equipo", 850.00, 2, "H", "1", "3"),
    ("IM-004", "Analizador de redes eléctricas trifásico", "Mide: kW, kVAR, factor de potencia, THD, Modbus RS485", "und", "Equipo", 2200.00, 1, "H", "1", "4"),
    ("IM-005", "Nivel láser de líneas cruzadas IP54", "Horizontal y vertical, alcance 30m, IP54, trípode incluido", "und", "Equipo", 285.00, 2, "H", "2", "1"),
    ("IM-006", "Telurómetro digital 4 hilos", "Medición resistencia de tierra 0-2000 Ohm, método Wenner", "und", "Equipo", 980.00, 1, "H", "2", "2"),
    ("IM-007", "Termómetro infrarrojo -50 a 1000°C", "Precisión más menos 1.5°C, ratio D:S 50:1, puntero láser doble", "und", "Equipo", 420.00, 2, "H", "2", "3"),
    ("IM-008", "Detector de voltaje sin contacto 12V-1000V", "Detección AC 12V-1000V, alarma audible y LED, autoapagado", "und", "Equipo", 85.00, 5, "H", "2", "4"),
]

RACK_DESC = {
    "A": "Zona Herramientas Eléctricas — Pared norte, estantes metálicos",
    "B": "Zona Tuberías y Conduit — Pasillo central, racks abiertos",
    "C": "Zona Cables y Conductores — Pared este, porta-bobinas",
    "D": "Zona Equipos Eléctricos — Pasillo sur, vitrinas con seguro",
    "E": "Zona EPPs — Entrada almacén, armarios cerrados con llave",
    "F": "Zona Consumibles — Pasillo oeste, cajones clasificados por nivel",
    "G": "Zona Accesorios Eléctricos — Pared sur, bins plásticos etiquetados",
    "H": "Zona Instrumentos de Medición — Vitrina climatizada y asegurada",
}

print(f"Total materials to insert: {len(MATERIALS)}")

with db_connection() as conn:
    cur = conn.cursor()
    inserted_mats = 0
    inserted_mov = 0
    inserted_loc = 0

    for row in MATERIALS:
        code, name, desc, unit, cat, cost, min_st, rack, level, box = row
        mat_id = str(uuid.uuid4())

        cur.execute(
            """
            INSERT INTO materials (id, code, name, description, unit, category, unit_cost, min_stock, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (code) DO NOTHING
            """,
            (mat_id, code, name, desc, unit, cat, cost, min_st, NOW),
        )

        if cur.rowcount == 0:
            print(f"  SKIP (code exists): {code}")
            continue

        inserted_mats += 1

        # Stock movement IN -> ALM-CENTRAL qty=100
        mov_id = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO stock_movements (id, material_id, movement_type, quantity, to_warehouse,
                                         reference, notes, created_by, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                mov_id, mat_id, "IN", 100, WH_ID,
                f"CARGA-INICIAL-{code}",
                "Carga inicial de inventario — 100 unidades",
                "SYSTEM", NOW,
            ),
        )
        inserted_mov += 1

        # Stock location with rack/level/box coding
        loc_id = str(uuid.uuid4())
        pos_ref = f"{RACK_DESC[rack]} — nivel {level}, posición {box}"
        cur.execute(
            """
            INSERT INTO stock_locations (id, material_id, warehouse_id, rack, level, box, position, quantity, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (loc_id, mat_id, WH_ID, rack, level, box, pos_ref, 100, NOW, NOW),
        )
        inserted_loc += 1

    conn.commit()
    print(f"\nInserted: {inserted_mats} materials, {inserted_mov} movements, {inserted_loc} locations")

    cur.execute("SELECT COUNT(*) FROM materials")
    print(f"Total materials in DB: {cur.fetchone()[0]}")
    cur.execute("SELECT COUNT(*) FROM stock_locations")
    print(f"Total stock_locations in DB: {cur.fetchone()[0]}")

    # Sample verification
    cur.execute("""
        SELECT m.code, m.name, m.category, sl.rack, sl.level, sl.box, sl.quantity
        FROM materials m
        JOIN stock_locations sl ON sl.material_id = m.id
        ORDER BY m.code
        LIMIT 10
    """)
    print("\nSample stock_locations:")
    for r in cur.fetchall():
        print(f"  {r[0]} | {r[1][:40]:<40} | {r[2]:<12} | {r[3]}-{r[4]}-{r[5]} | qty={r[6]}")
