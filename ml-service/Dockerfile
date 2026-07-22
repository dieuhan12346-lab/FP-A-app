FROM python:3.12-slim

# xgboost cần libgomp
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN pip install --no-cache-dir \
    "fastapi>=0.115" "uvicorn[standard]>=0.30" "pydantic>=2.7" "httpx>=0.27" "pyjwt[crypto]>=2.8" \
    "numpy>=1.26" "pandas>=2.2" "scikit-learn>=1.4" "xgboost>=2.0"

COPY forecast.py app.py ./
ENV PYTHONUNBUFFERED=1

# Railway/Render tiêm $PORT; mặc định 8000 khi chạy local
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
