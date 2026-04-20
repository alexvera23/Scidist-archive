from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import pipeline
from typing import List, Optional
import torch

app = FastAPI(title="SciDist Classifier AI")

# Cargamos el modelo al iniciar (Zero-Shot Classification)
# Usamos un modelo multilingüe de alta precisión
model_name = "MoritzLaurer/mDeBERTa-v3-base-mnli-xnli"
device = 0 if torch.cuda.is_available() else -1 # Usar GPU si está disponible

print(f"Cargando modelo {model_name}...")
classifier = pipeline("zero-shot-classification", model=model_name, device=device)

class ClassificationRequest(BaseModel):
    text: str
    candidate_labels: List[str]

@app.post("/classify")
async def classify_text(request: ClassificationRequest):
    if not request.candidate_labels:
        raise HTTPException(status_code=400, detail="Se requiere al menos una etiqueta candidata")

    try:
        # El modelo compara el texto con cada etiqueta y da un puntaje
        result = classifier(request.text, request.candidate_labels, multi_label=False)
        
        # El resultado viene ordenado por puntaje de mayor a menor
        best_label = result['labels'][0]
        score = result['scores'][0]
        
        return {
            "best_label": best_label,
            "confidence": score,
            "all_scores": dict(zip(result['labels'], result['scores']))
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "AI Model is ready", "device": "gpu" if device == 0 else "cpu"}