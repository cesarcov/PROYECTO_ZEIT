from pydantic import BaseModel
from typing import List

class SearchResult(BaseModel):
    category: str
    title: str
    subtitle: str
    link: str

class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
