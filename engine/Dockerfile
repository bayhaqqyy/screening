FROM python:3.10-slim

WORKDIR /app

# Install dependencies required for confluent-kafka and pandas
RUN apt-get update && \
    apt-get install -y gcc g++ librdkafka-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Command will be overridden by docker-compose for each specific worker
CMD ["python", "streaming/indicator_consumer.py"]
