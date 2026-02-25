import os
import uuid
import json
from datetime import datetime
from firecrawl import FirecrawlApp
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
from dotenv import load_dotenv

load_dotenv()

# In-memory DB for the demo (will upgrade to Postgres/Redis later)
JOB_STORE = {}

# Initialize Clients
es_client = Elasticsearch(
    os.getenv("ELASTIC_URL"),
    api_key=os.getenv("ELASTIC_API_KEY")
)
firecrawl_app = FirecrawlApp(api_key=os.getenv("FIRECRAWL_API_KEY"))

# LLM Extraction Schema
PRODUCT_SCHEMA = {
    "type": "object",
    "properties": {
        "products": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "price": {"type": "string"},
                    "description": {"type": "string"},
                    "image": {"type": "string", "format": "uri"},
                    "url": {"type": "string", "format": "uri"}
                },
                "required": ["title", "price", "description", "url"]
            }
        }
    },
    "required": ["products"]
}

def create_job(tenant_id: str, domain: str) -> str:
    job_id = str(uuid.uuid4())
    JOB_STORE[job_id] = {
        "id": job_id,
        "tenant_id": tenant_id,
        "domain": domain,
        "status": "pending",
        "product_count": 0,
        "error": None,
        "created_at": datetime.utcnow().isoformat()
    }
    return job_id

def process_onboarding(job_id: str, domain: str, tenant_id: str):
    JOB_STORE[job_id]["status"] = "processing"
    
    try:
        # 1. LIVE SCRAPE VIA FIRECRAWL
        print(f"[{job_id}] Starting live crawl for {domain}...")
        crawl_result = firecrawl_app.crawl_url(
            url=domain,
            params={
                "limit": 200, # Keep limit low for fast live demo
                "extract": {
                    "schema": PRODUCT_SCHEMA,
                    "systemPrompt": "Extract all visible e-commerce products. Include title, price, full description, and image URL."
                }
            }
        )
        
        # 2. PARSE RESULTS
        all_products = []
        # Firecrawl returns a list of dictionaries for crawled pages
        for page in crawl_result:
            if "extracted_content" in page and page["extracted_content"]:
                # Sometimes it returns a string, sometimes a dict
                content = page["extracted_content"]
                if isinstance(content, str):
                    try:
                        content = json.loads(content)
                    except:
                        continue
                all_products.extend(content.get("products", []))
        
        if not all_products:
            raise Exception("No products found during crawl.")

        print(f"[{job_id}] Extracted {len(all_products)} products. Ingesting to Elastic...")

        # 3. BULK INGEST TO ELASTICSEARCH
        es_docs = []
        for p in all_products:
            doc_id = f"{tenant_id}_{hash(p['url'])}"
            # Combine fields for the semantic_text embedding target
            p["content_semantic"] = f"{p.get('title', '')} {p.get('description', '')}"
            p["tenant_id"] = tenant_id
            
            es_docs.append({
                "_op_type": "index",
                "_index": "sensesindia-products", # Update index name if needed
                "_id": doc_id,
                "_source": p
            })
            
        bulk(es_client, es_docs)
        
        # 4. MARK SUCCESS
        JOB_STORE[job_id]["status"] = "completed"
        JOB_STORE[job_id]["product_count"] = len(es_docs)
        print(f"[{job_id}] Onboarding complete!")

    except Exception as e:
        print(f"[{job_id}] Error: {str(e)}")
        JOB_STORE[job_id]["status"] = "failed"
        JOB_STORE[job_id]["error"] = str(e)
