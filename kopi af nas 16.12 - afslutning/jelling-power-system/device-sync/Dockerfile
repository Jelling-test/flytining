FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY device_sync.py .

CMD ["python", "-u", "device_sync.py"]
