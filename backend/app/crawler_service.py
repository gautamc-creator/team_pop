import os
import uuid
import json
from datetime import datetime
from firecrawl import Firecrawl
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
firecrawl_app = Firecrawl(api_key=os.getenv("FIRECRAWL_API_KEY"))

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
        print(f"[{job_id}] Starting optimized extract for {domain}...")

        # === OPTIMIZED EXTRACT CALL (free-tier friendly) ===
        result = firecrawl_app.extract(
            urls=["https://sensesindia.in/"],   # wildcard = full site (experimental but works great on Shopify)
            prompt="""You are an expert e-commerce data extractor for a premium men's clothing Shopify store (Senses India).
            Extract EVERY visible product you can find.
            - title: exact product name
            - price: full price string including "Rs." and any sale info
            - description: FULL detailed description. Include materials (e.g. 60s Viscose, Polyamide), fit (slim, relaxed), model info, size guide, care instructions, everything visible on the page or product card. Never leave empty.
            - image: direct high-resolution main product image URL (not thumbnail)
            - url: full product purchase URL
            Do not duplicate products. Only real products.""",
            # Optional speed/quality tweaks
            # enable_web_search=False,   # not needed
            # agent={"model": "FIRE-1"}  # only if site has heavy JS/pagination (adds cost)
        )

        # Extract products (new return shape)
        data = result.data if hasattr(result, "data") else result
        all_products = data.get("products", []) if isinstance(data, dict) else []

        if not all_products:
            raise Exception("No products extracted.")

        print(f"[{job_id}] Extracted {len(all_products)} products. Ingesting...")

        # === Rest of your code unchanged ===
        es_docs = []
        for p in all_products:
            doc_id = f"{tenant_id}_{hash(p.get('url', ''))}"
            p["content_semantic"] = f"{p.get('title', '')} {p.get('description', '')}"
            p["tenant_id"] = tenant_id
            es_docs.append({
                "_op_type": "index",
                "_index": "sensesindia-products",
                "_id": doc_id,
                "_source": p
            })

        bulk(es_client, es_docs)

        JOB_STORE[job_id]["status"] = "completed"
        JOB_STORE[job_id]["product_count"] = len(es_docs)
        print(f"[{job_id}] Onboarding complete! ({len(es_docs)} products)")

    except Exception as e:
        print(f"[{job_id}] Error: {str(e)}")
        JOB_STORE[job_id]["status"] = "failed"
        JOB_STORE[job_id]["error"] = str(e)
