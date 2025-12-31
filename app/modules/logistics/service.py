# app/modules/logistics/service.py

from datetime import datetime
from typing import Dict


class LogisticsService:
    """
    Capa de lógica de negocio del módulo de logística
    """

    @staticmethod
    def create_stock_movement(data: Dict) -> Dict:
        """
        Regla central para crear movimientos de stock.
        Aquí NO hay FastAPI, NO hay HTTP.
        Solo reglas de negocio.
        """

        movement_type = data.get("movement_type")
        quantity = data.get("quantity")

        # 1️⃣ Validaciones básicas
        if quantity is None or quantity <= 0:
            raise ValueError("La cantidad debe ser mayor a cero")

        if movement_type not in ["IN", "OUT", "TRANSFER", "ADJUST", "RETURN"]:
            raise ValueError("Tipo de movimiento no válido")

        # 2️⃣ Reglas por tipo (por ahora simples)
        if movement_type == "OUT":
            # luego validaremos stock disponible
            pass

        if movement_type == "TRANSFER":
            # luego validaremos almacén origen/destino
            pass

        # 3️⃣ Simulación de resultado (temporal)
        return {
            "status": "ok",
            "movement_type": movement_type,
            "quantity": quantity,
            "processed_at": datetime.utcnow().isoformat()
        }
