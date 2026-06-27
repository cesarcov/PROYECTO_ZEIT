from fastapi import APIRouter, Depends, Query
from app.core.security.dependencies import get_current_user
from app.modules.search.schemas import SearchResponse, SearchResult
from app.modules.search.service import global_search_service

router = APIRouter(prefix="/search", tags=["Búsqueda"])

@router.get("", response_model=SearchResponse)
def global_search(
    q: str = Query("", min_length=2, description="Término de búsqueda (mínimo 2 caracteres)"),
    current_user = Depends(get_current_user)
):
    results = global_search_service(q, current_user)
    formatted_results = [SearchResult(**r) for r in results]
    return SearchResponse(query=q, results=formatted_results)
