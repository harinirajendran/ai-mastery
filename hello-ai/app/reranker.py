# app/reranker.py
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
from typing import List, Tuple

class Reranker:
    def __init__(self, model_name="BAAI/bge-reranker-large"):
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_name)

    def rerank(self, query: str, passages: List[str], top_k: int = 5) -> List[Tuple[str, float]]:
        pairs = [(query, passage) for passage in passages]
        print("Pairs:", pairs)
        if len(pairs) == 0:
            return []
        inputs = self.tokenizer.batch_encode_plus(
            pairs, padding=True, truncation=True, return_tensors="pt"
        )
        with torch.no_grad():
            scores = self.model(**inputs).logits.squeeze(-1).tolist()

        # Sort passages by score (higher is better)
        ranked = sorted(zip(passages, scores), key=lambda x: x[1], reverse=True)
        return ranked[:top_k]