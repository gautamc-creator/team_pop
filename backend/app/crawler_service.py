import docker
import yaml
import os
import uuid 
import shutil
from app.elastic import generate_index_name , create_client_index
from langfuse import observe
from dotenv import load_dotenv

load_dotenv()

try:
    docker_client = docker.from_env()
except Exception as e:
    print(f"Docker not detected : {e}")
    docker_client = None

# In-memory crawl status for local demo
# key: normalized url, value: dict(status, index, error)
CRAWL_STATUS = {}

def normailizeUrl(url: str) -> str:
    return url[:-1] if url.endswith('/') else url

def set_crawl_status(url: str, status: str, index: str | None = None, error: str | None = None):
    CRAWL_STATUS[normailizeUrl(url)] = {
        "status": status,
        "index": index,
        "error": error
    }

def get_crawl_status(url: str):
    return CRAWL_STATUS.get(normailizeUrl(url))

@observe(name="docker-crawler-execution")
def run_elastic_crawler(target_url : str):
    if not docker_client:
        print("Skipping crawl : Docker unavailable")
        set_crawl_status(target_url, "failed", error="Docker unavailable on host")
        return
    

    
    formatted_url = normailizeUrl(target_url)
    print(formatted_url)
    
    # index creation
    index_name = generate_index_name(formatted_url)
    create_client_index(index_name)
    set_crawl_status(formatted_url, "running", index=index_name)
    
    crawl_id = str(uuid.uuid4())
    
    # Crawler config
    config_data = {
        "output_sink": "elasticsearch",
        "output_index": index_name,
        "elasticsearch": {
            "host": os.getenv("ELASTIC_URL"),
            "api_key": os.getenv("ELASTIC_API_KEY"),
            "port":"443",
            "pipeline_enabled": False, 
            "ssl_verification_mode": "none"
        },
        "domains": [
            {
                "url": formatted_url,
                "max_crawl_depth":2
            }
        ]
    }
    
    # Temporary directory for the config
    temp_dir = os.path.abspath(f"temp_crawls/{crawl_id}")
    os.makedirs(temp_dir, exist_ok=True)
    config_path = os.path.join(temp_dir, "crawler.yml")

    with open(config_path, 'w') as f:
        yaml.dump(config_data, f)

    print(f"Starting Crawler for {formatted_url} (ID: {crawl_id})")
    
    
    # Run the elastic crawler container 
    try:
        container = docker_client.containers.run(
            image="docker.elastic.co/integrations/crawler:latest",
            # The crawler requires the config file to be passed as an argument
            # FORCE bash to execute the string as a commnad 
            entrypoint="/bin/bash",
            command=["-c", "bin/crawler crawl /crawler.yml"],
            volumes={
                # Mount our generated config to /crawler.yml inside container
                config_path: {'bind': '/crawler.yml', 'mode': 'ro'}
            },
            detach=True,
            remove=False, # Auto-delete container when done
            # Use 'host' network if Elastic is on localhost, otherwise 'bridge' is fine
            network_mode="host" if "localhost" in os.getenv("ELASTIC_URL") or "127.0.0.1" in os.getenv("ELASTIC_URL") else "bridge"
        )
        print(f"Container started: {container.id[:10]}.Waiting for logs")
        
        # To capture the logs
        result = container.wait()
        logs = container.logs().decode('utf-8')
        
        print("\n" + "="*20 + " CRAWLER LOGS " + "="*20)
        print(logs)
        print("="*54 + "\n")
        
        # cleanup
        container.remove()
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        if result['StatusCode'] != 0:
            print(f"❌ Crawler exited with error code {result['StatusCode']}")
            raise Exception(f"Crawler failed: {logs}")

        set_crawl_status(formatted_url, "completed", index=index_name)
        return {"status": "completed", "index": index_name, "logs": logs}
        
        

    except Exception as e:
        print(f"❌ Crawl failed: {e}")
        # Clean up temp dir if fail
        shutil.rmtree(temp_dir, ignore_errors=True)
        set_crawl_status(formatted_url, "failed", index=index_name, error=str(e))
        raise e
    
    
