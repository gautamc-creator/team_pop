from elasticsearch import Elasticsearch
import os
from dotenv import load_dotenv

load_dotenv()

ELASTIC_URL = os.getenv("ELASTIC_URL")
ELASTIC_API_KEY = os.getenv("ELASTIC_API_KEY")  


es = Elasticsearch(
    hosts=[ELASTIC_URL],  
    api_key=ELASTIC_API_KEY  
)

