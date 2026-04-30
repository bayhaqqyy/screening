import json
import time
import random
from datetime import datetime
from kafka import KafkaProducer

KAFKA_BROKER = "localhost:9092"
TOPIC_NEWS = "idx.news.updates"

TICKERS = ["BBCA", "BBRI", "BMRI", "BBNI", "ASII", "TLKM", "GOTO", "AMMN", "BREN", "CUAN"]
NEWS_TEMPLATES = [
    "{ticker} Announces Q3 Earnings Above Analyst Expectations",
    "Major Block Trade Detected for {ticker} by Foreign Institutional Investor",
    "{ticker} CEO Discusses Future Expansion Plans in Recent Interview",
    "Market Reacts to {ticker}'s New Joint Venture Announcement",
    "{ticker} Faces Regulatory Scrutiny Over Recent Acquisition",
    "Insider Buying Surges in {ticker} as Stock Nears 52-Week Low",
    "Dividend Yield Increase Proposed by {ticker} Board",
    "Analyst Upgrades {ticker} to 'Strong Buy' with Increased Price Target",
    "{ticker} Experiences Unusually High Options Volume Today",
    "Global Market Trends Impact {ticker}'s Supply Chain Outlook"
]

def generate_mock_news():
    ticker = random.choice(TICKERS)
    template = random.choice(NEWS_TEMPLATES)
    headline = template.format(ticker=ticker)
    
    # 0 = negative, 1 = neutral, 2 = positive
    sentiment_score = random.uniform(-1.0, 1.0)
    sentiment = "neutral"
    if sentiment_score > 0.3:
        sentiment = "positive"
    elif sentiment_score < -0.3:
        sentiment = "negative"

    return {
        "id": f"news_{int(time.time())}_{random.randint(1000, 9999)}",
        "ticker": ticker,
        "headline": headline,
        "source": random.choice(["CNBC Indonesia", "Bisnis.com", "Kontan", "Bloomberg", "Reuters"]),
        "timestamp": datetime.now().isoformat(),
        "sentiment": sentiment,
        "sentiment_score": round(sentiment_score, 2),
        "url": f"https://mock-news-portal.com/article/{ticker.lower()}-{int(time.time())}"
    }

def main():
    print(f"Connecting to Kafka broker at {KAFKA_BROKER}...")
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BROKER,
        value_serializer=lambda v: json.dumps(v).encode('utf-8')
    )
    print("Successfully connected. Starting news publisher...")

    try:
        while True:
            news_item = generate_mock_news()
            
            # Send to Kafka
            producer.send(TOPIC_NEWS, key=news_item["ticker"].encode('utf-8'), value=news_item)
            producer.flush()
            
            print(f"[{news_item['timestamp']}] Published: {news_item['headline']} ({news_item['sentiment']})")
            
            # Wait for 5 to 15 seconds before publishing the next news
            time.sleep(random.uniform(5.0, 15.0))
            
    except KeyboardInterrupt:
        print("\nStopping news producer...")
    except Exception as e:
        print(f"Error occurred: {e}")
    finally:
        producer.close()

if __name__ == "__main__":
    main()
