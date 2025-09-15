# ✅ Start from slim Python image
FROM python:3.11-slim

# Prevent Python from writing .pyc files & buffering stdout
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system deps (needed for psycopg2, PyPDF2, etc.)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# ✅ Install dependencies (CPU-only torch to save space)
RUN pip install --no-cache-dir -r requirements.txt \
    torch==2.3.0+cpu torchvision==0.18.0+cpu torchaudio==2.3.0+cpu \
    -f https://download.pytorch.org/whl/torch_stable.html

# Copy the app code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Run the FastAPI app with uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
