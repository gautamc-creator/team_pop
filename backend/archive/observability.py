import os
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from dotenv import load_dotenv

load_dotenv()
print(f"Current Langfuse Host: {os.environ.get('LANGFUSE_HOST')}")

def setup_observability(app):
    # 1. Configure Langfuse as the destination for traces
    # Langfuse acts as an OTel collector natively
    otlp_exporter = OTLPSpanExporter(
        endpoint="https://cloud.langfuse.com/api/public/otel/v1/traces",
        headers={
            "Authorization": f"Basic {os.getenv('LANGFUSE_PUBLIC_KEY')}:{os.getenv('LANGFUSE_SECRET_KEY')}"
        }
    )

    # 2. Set up the Tracer Provider
    provider = TracerProvider()
    provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
    trace.set_tracer_provider(provider)

    # 3. Auto-Instrument HTTP Requests
    # This is critical: It captures AssemblyAI and ElevenLabs calls automatically
    RequestsInstrumentor().instrument() 
    
    # 4. Instrument FastAPI (Captures incoming /chat, /stt requests)
    FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)