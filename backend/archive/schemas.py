
from pydantic import BaseModel
from typing import List, Optional

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    domain: Optional[str] = None

class SearchResult(BaseModel):
    title: str
    url: str
    content: str
