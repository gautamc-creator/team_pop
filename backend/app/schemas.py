
from pydantic import BaseModel
from typing import List, Dict

class ChatRequest(BaseModel):
    query: str

class SearchResult(BaseModel):
    title: str
    url: str
    content: str
