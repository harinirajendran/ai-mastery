# db/pgvector_db.py
import os
import psycopg2 as psycopg2
from typing import List, Tuple
from openai import OpenAI

class PGVectorDB:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.conn_params = dict(
            host=os.getenv("PG_HOST", "localhost"),
            port=os.getenv("PG_PORT", "5432"),
            user=os.getenv("PG_USER", "postgres"),
            password=os.getenv("PG_PASSWORD", "password"),
            dbname=os.getenv("PG_DB", "postgres")
        )

    def embed(self, text: str) -> List[float]:
        resp = self.client.embeddings.create(
            model="text-embedding-3-small",
            input=text
        )
        return resp.data[0].embedding

    def ingest_text(self, text: str) -> None:
        emb = self.embed(text)
        conn = psycopg2.connect(**self.conn_params)
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO documents (content, embedding) VALUES (%s, %s)",
            (text, emb)
        )
        conn.commit()
        cur.close(); conn.close()

    def query(self, q: str, top_k: int = 3) -> List[Tuple[str, float]]:
        qvec = self.embed(q)
        conn = psycopg2.connect(**self.conn_params)
        cur = conn.cursor()
        cur.execute(
            """
            SELECT content, embedding <#> %s::vector AS distance
            FROM documents
            ORDER BY distance
            LIMIT %s
            """,
            (qvec, top_k)
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        return rows

    def hybrid_query(self, q: str, top_k: int = 3) -> List[Tuple[str, float, float]]:
        qvec = self.embed(q)
        conn = psycopg2.connect(**self.conn_params)
        cur = conn.cursor()
        cur.execute(
            """
            SELECT content,
                (embedding <#> %s::vector) AS distance,
                ts_rank_cd(tsv, plainto_tsquery(%s)) AS keyword_score
            FROM documents
            ORDER BY (embedding <#> %s::vector) + (1 - COALESCE(ts_rank_cd(tsv, plainto_tsquery(%s)), 0)) ASC
            LIMIT %s
            """,
            (qvec, q, qvec, q, top_k)
        )
        rows = cur.fetchall()
        cur.close(); conn.close()
        return rows