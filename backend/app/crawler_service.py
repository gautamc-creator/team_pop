import docker
import yaml
import os
import uuid 
import shutil
from app.elastic import generate_index_name , create_client_index
from langfuse import observe

try:
    docker_client = docker.from_env()
except Exception as e:
    print(f"Docker not detected : {e}")
    docker_client = None
    

@observe(name="docker-crawler-execution")
def run_elastic_crawler(target_url : str):
    if not docker_client:
        print("Skipping crawl : Docker unavailable")
        return
    
    # index creation
    index_name = generate_index_name(target_url)
    create_client_index(index_name)
    
    crawl_id = str(uuid.uuid4())
    
    # Crawler config
    config_data = {
        "output_sink": "elasticsearch",
        "output_index": index_name,
        "elasticsearch": {
            "host": os.getenv("ELASTIC_URL"),
            "api_key": os.getenv("ELASTIC_API_KEY"),
            "pipeline_enabled": False, 
        },
        "domains": [
            {
                "url": target_url,
            }
        ]
    }
    
    # Temporary directory for the config
    temp_dir = os.path.abspath(f"temp_crawls/{crawl_id}")
    os.makedirs(temp_dir, exist_ok=True)
    config_path = os.path.join(temp_dir, "crawler.yml")

    with open(config_path, 'w') as f:
        yaml.dump(config_data, f)

    print(f"Starting Crawler for {target_url} (ID: {crawl_id})")
    
    
    # Run the elastic crawler container 
    try:
        container = docker_client.containers.run(
            image="docker.elastic.co/integrations/crawler:latest",
            # The crawler requires the config file to be passed as an argument
            command=["bin/crawler", "crawl", "/crawler.yml"],
            volumes={
                # Mount our generated config to /crawler.yml inside container
                config_path: {'bind': '/crawler.yml', 'mode': 'ro'}
            },
            detach=True,
            remove=True, # Auto-delete container when done
            # Use 'host' network if Elastic is on localhost, otherwise 'bridge' is fine
            network_mode="host" if "localhost" in os.getenv("ELASTIC_URL", "") else "bridge"
        )
        print(f"Container started: {container.id}")
        return {"status": "started", "index": index_name, "crawl_id": crawl_id}

    except Exception as e:
        print(f"❌ Crawl failed: {e}")
        # Clean up temp dir if fail
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise e
    
    