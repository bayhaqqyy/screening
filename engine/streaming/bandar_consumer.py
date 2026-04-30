import json
import os
import sys
import pandas as pd
from confluent_kafka import Consumer, Producer

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from screeners.bandar_analysis import analyze_accumulation

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
TOPIC_RAW = "idx.ohlcv.raw"
TOPIC_BANDAR = "idx.bandar.flow"

def create_consumer():
    return Consumer({
        'bootstrap.servers': KAFKA_BROKER,
        'group.id': 'bandar-analyzer',
        'auto.offset.reset': 'earliest'
    })

def create_producer():
    return Producer({'bootstrap.servers': KAFKA_BROKER})

def main():
    consumer = create_consumer()
    producer = create_producer()
    
    try:
        consumer.subscribe([TOPIC_RAW])
        print(f"Bandar Analyzer started. Listening to {TOPIC_RAW}...")
        
        while True:
            msg = consumer.poll(1.0)
            
            if msg is None:
                continue
            if msg.error():
                print(f"Consumer error: {msg.error()}")
                continue
            
            try:
                data = json.loads(msg.value().decode('utf-8'))
                ticker = data['ticker']
                history = data['history']
                
                df = pd.DataFrame(history)
                result = analyze_accumulation(df, ticker)
                
                if result:
                    producer.produce(
                        TOPIC_BANDAR,
                        key=ticker,
                        value=json.dumps(result)
                    )
                    producer.poll(0)
                    print(f"Bandar analysis complete for {ticker} -> Score: {result['accum_score']}")
            except Exception as e:
                print(f"Error processing message: {e}")
                
    except KeyboardInterrupt:
        pass
    finally:
        consumer.close()
        producer.flush()

if __name__ == "__main__":
    main()
