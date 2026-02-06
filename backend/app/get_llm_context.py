import json
from app.elastic import es

# 1. Initialize the Client
# Replace with your actual Elastic Cloud details



def get_llm_context(user_query,index_name = "search-index-final-sense"):
    """
    Performs Hybrid Search using RRF and returns formatted context + sources.
    """
    index_name = "search-index-final-sense"
    
    # Modern 'Retriever' syntax for Elasticsearch 9.x
    search_body = {
        "retriever": {
            "rrf": {
                "retrievers": [
                    {
                        "standard": {
                            "query": {
                                "multi_match": {
                                    "query": user_query,
                                    "fields": ["title", "body", "headings"]
                                }
                            }
                        }
                    },
                    {
                        "standard": {
                            "query": {
                                "semantic": {
                                    "field": "semantic_text",
                                    "query": user_query
                                }
                            }
                        }
                    }
                ]
            }
        },
        # Fetch only what the LLM needs
        "_source": ["body", "url", "title"],
        "size": 3
    }
    
    try:
        response = es.search(index=index_name, body=search_body)
        hits = response['hits']['hits']
    except Exception as e:
        print(f"Search error on {index_name}: {e}")
        return "", []
    
    
    
    context_blocks = []
    sources = []

    for i, hit in enumerate(hits, 1):
        source_data = hit['_source']
        body_text = source_data.get('body', '')
        url = source_data.get('url', 'N/A')
        title = source_data.get('title', 'Untitled')

        # Format each chunk for the LLM
        block = f"--- SOURCE {i} ---\nTitle: {title}\nURL: {url}\nContent: {body_text}\n"
        context_blocks.append(block)
        sources.append(url)

    return "\n".join(context_blocks), sources



