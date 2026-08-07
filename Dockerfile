FROM python:3.10-slim

WORKDIR /app

# Install build dependencies for xgboost and other packages
RUN apt-get update && apt-get install -y \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir --pre pandas-ta

# Copy the rest of the application
COPY . .

# Expose the port FastAPI runs on
RUN chmod +x quant_engine_cpp/quant_math.exe
EXPOSE 8000

# Start the application
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
