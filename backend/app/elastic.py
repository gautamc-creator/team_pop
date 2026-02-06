from elasticsearch import Elasticsearch
import os
from dotenv import load_dotenv
import re

load_dotenv()

ELASTIC_URL = os.getenv("ELASTIC_URL")
ELASTIC_API_KEY = os.getenv("ELASTIC_API_KEY")  


es = Elasticsearch(
    hosts=[ELASTIC_URL],  
    api_key=ELASTIC_API_KEY  
)

def generate_index_name(domain: str) -> str:
    """
    Converts a URL into a safe index name.
    Example: https://www.example.com -> crawl-example-com
    """
    # Remove protocol
    clean = re.sub(r'^https?://', '', domain)
    # Remove 'www.'
    clean = re.sub(r'^www\.', '', clean)
    # Remove paths/queries, keep only domain
    clean = clean.split('/')[0]
    # Replace non-alphanumeric characters with dashes
    clean = re.sub(r'[^a-z0-9]', '-', clean.lower())
    # Remove leading/trailing dashes
    clean = clean.strip('-')
    
    return f"crawl-{clean}"

def create_client_index(index_name: str):
    """
    Creates the index with the specific mappings required for 
    your Hybrid Search (Semantic + Keyword) to work.
    """
    if not es.indices.exists(index=index_name):
        mappings = {
            "properties": {
                # Standard fields populated by the crawler
                "title": {
                    "type": "text", 
                    "copy_to": "semantic_text" 
                },
                "body": {
                    "type": "text", 
                    "copy_to": "semantic_text" 
                },
                "headings": {
                    "type": "text"
                },
                "url": {
                    "type": "keyword"
                },
                # Your specific semantic field for RRF/Hybrid search
                "semantic_text": {
                    "type": "semantic_text",
                    # Ensure this matches the model you have deployed in Elastic
                    "inference_id": ".elser-2-elastic" 
                }
            }
        }
        
        try:
            es.indices.create(index=index_name, mappings=mappings)
            print(f"✅ Created new index: {index_name}")
        except Exception as e:
            print(f"⚠️ Failed to create index {index_name}: {e}")
    else:
        print(f"ℹ️ Index {index_name} already exists.")
    
    return index_name