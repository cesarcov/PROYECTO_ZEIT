from fastapi import APIRouter

router = APIRouter(
    prefix="/stock-movements",
    tags=["Logistics"]
)

@router.post("/")
def create_stock_movement():
    return {"message": "Stock movement created"}
