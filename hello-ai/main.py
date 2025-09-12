from openai import OpenAI
from dotenv import load_dotenv
import os
import time, uuid, logging
from fastapi import FastAPI, Request
from pythonjsonlogger import jsonlogger
from pydantic import BaseModel, Field
from typing import Optional
from fastapi import HTTPException, Query
from openai import APIConnectionError, APITimeoutError, RateLimitError, BadRequestError
from db.pgvector_db import PGVectorDB
from fastapi.responses import StreamingResponse
from fastapi.responses import JSONResponse

from fastapi.middleware.cors import CORSMiddleware
# Load environment variables from .env file
load_dotenv()

app = FastAPI(title="hello-ai", version="0.1.0")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
db = PGVectorDB()

# ----- logging setup -----
logger = logging.getLogger("app")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(jsonlogger.JsonFormatter("%(levelname)s %(message)s"))
logger.handlers = [handler]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # lock down to your domain later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    rid = str(uuid.uuid4())[:8]
    start = time.time()
    response = await call_next(request)
    latency_ms = int((time.time() - start) * 1000)
    logger.info(
        "request_complete",
        extra={
            "request_id": rid,
            "path": request.url.path,
            "status": response.status_code,
            "latency_ms": latency_ms,
            "method": request.method,
        },
    )
    response.headers["X-Request-ID"] = rid
    return response

@app.get("/ping")
def ping() -> dict:
    return {"pong": True}


@app.get("/")
def root() -> dict:
    return {"message": "hello-ai is up"}

class IngestRequest(BaseModel):
    text: str

@app.post("/api/ingest")
def ingest_doc(req: IngestRequest):
    db.ingest(req.text)
    return {"status": "ok", "message": "Document ingested"}

@app.get("/api/qa")
def qa(query: str = Query(..., min_length=2)):
    # 1. Retrieve from DB
    rows = db.query(query, top_k=3)
    context = "\n".join([r[0] for r in rows])

    # 2. Ask GPT
    start = time.time()
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Answer based only on context"},
            {"role": "user", "content": f"Context:\n{context}\n\nQ: {query}"}
        ]
    )
    answer = resp.choices[0].message.content

    return JSONResponse({
        "query": query,
        "answer": answer,
        "context_used": rows,
        "latency_ms": int((time.time() - start) * 1000)
    })


# ---- response schema ----
class ChatResponse(BaseModel):
    reply: str = Field(..., description="Model's reply text")
    model: str = Field(..., description="Model used")
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    latency_ms: int

# ---- simple retry with backoff ----
def call_openai_with_retry(messages, model="gpt-4o-mini", timeout=20, max_retries=2):
    last_err = None
    for attempt in range(max_retries + 1):
        try:
            return client.chat.completions.create(
                model=model,
                messages=messages,
                timeout=timeout,  # seconds
            )
        except (APIConnectionError, APITimeoutError) as e:
            last_err = e
        except RateLimitError as e:
            last_err = e
        except BadRequestError as e:
            # no point retrying invalid request; bubble up
            raise e
        # backoff: 0s, 0.8s, 1.6s ...
        time.sleep(0.8 * (2 ** attempt))
    raise last_err or RuntimeError("Unknown error calling OpenAI")

@app.get("/api/chat", response_model=ChatResponse)
def chat(prompt: str = Query(..., min_length=1, max_length=2000)):
    start = time.time()
    try:
        resp = call_openai_with_retry(
            messages=[{"role": "user", "content": prompt}],
            model="gpt-4o-mini",
            timeout=20,
            max_retries=2,
        )
        
        choice = resp.choices[0].message.content
        usage = getattr(resp, "usage", None)
        prompt_tokens = getattr(usage, "prompt_tokens", None) if usage else None
        completion_tokens = getattr(usage, "completion_tokens", None) if usage else None
        return ChatResponse(
            reply=choice,
            model=resp.model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            latency_ms=int((time.time() - start) * 1000),
        )
    except RateLimitError:
        raise HTTPException(status_code=429, detail="Rate limit from model; try later.")
    except BadRequestError as e:
        raise HTTPException(status_code=400, detail=f"Bad request: {e.__class__.__name__}")
    except (APIConnectionError, APITimeoutError):
        raise HTTPException(status_code=504, detail="Upstream model timeout.")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Unexpected server error: " + str(e))

@app.get("/api/chat/stream")
def chat_stream(prompt: str = Query(..., min_length=1)):
    def gen():
        stream = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role":"user","content":prompt}],
            stream=True,
            timeout=30,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            if delta:
                yield delta
    return StreamingResponse(gen(), media_type="text/plain")