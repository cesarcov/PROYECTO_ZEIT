from app.modules.logistics.routers.stock_movements import router as stock_router

def init_logistics(app):
    app.include_router(stock_router)
