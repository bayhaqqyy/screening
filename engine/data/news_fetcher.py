import feedparser
import schedule
import time
import json
import os
import sys
import pandas as pd
from datetime import datetime
from confluent_kafka import Producer

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
TOPIC_NEWS = "idx.news.updates"

def get_producer():
    try:
        return Producer({'bootstrap.servers': KAFKA_BROKER})
    except Exception as e:
        print(f"Warning: Could not connect to Kafka broker {KAFKA_BROKER}: {e}")
        return None

# Load tickers for dynamic tagging
try:
    df_tickers = pd.read_csv("idx_all_companies_info.csv")
    ALL_TICKERS = df_tickers['Ticker'].str.replace('.JK', '', regex=False).tolist()
except Exception as e:
    print(f"Warning: Could not load idx_all_companies_info.csv: {e}")
    ALL_TICKERS = []

def extract_tickers_from_text(text):
    text_upper = text.upper()
    found = []
    # Split text to words to match exact tickers
    words = set(text_upper.replace(',', ' ').replace('.', ' ').replace('-', ' ').split())
    for t in ALL_TICKERS:
        if t in words:
            found.append(t)
    return found

def fetch_market_news():
    print(f"[{datetime.now()}] Fetching market news...")
    
    # CNBC Indonesia Market RSS
    rss_url = "https://www.cnbcindonesia.com/market/rss"
    
    feed = feedparser.parse(rss_url)
    
    if not feed.entries:
        print("No news found.")
        return
        
    producer = get_producer()
    
    # We will just fetch the top 10 news
    news_list = []
    for entry in feed.entries[:10]:
        # Simple sentiment mock based on keywords
        title_lower = entry.title.lower()
        sentiment = "Neutral"
        sentiment_cls = "bg-on-surface-variant/10 text-on-surface-variant"
        dot_cls = "bg-on-surface-variant"
        
        bullish_words = ['naik', 'lonjak', 'rekor', 'cuan', 'laba', 'untung', 'positif', 'akumulasi', 'meroket', 'terbang']
        bearish_words = ['turun', 'anjlok', 'ambruk', 'rugi', 'negatif', 'distribusi', 'lepas', 'jual', 'merah', 'longsor']
        
        if any(w in title_lower for w in bullish_words):
            sentiment = "Bullish"
            sentiment_cls = "bg-secondary/10 text-secondary"
            dot_cls = "bg-secondary"
        elif any(w in title_lower for w in bearish_words):
            sentiment = "Bearish"
            sentiment_cls = "bg-error/10 text-error"
            dot_cls = "bg-error"
            
        # Extract dynamic tickers
        found_tickers = extract_tickers_from_text(entry.title)
        tags_str = "Market • Update"
        if found_tickers:
            tags_str = " • ".join(found_tickers[:3]) # Show up to 3 tickers
            
        news_item = {
            "title": entry.title,
            "link": entry.link,
            "time": entry.published,
            "desc": entry.get('description', ''),
            "sentiment": sentiment,
            "sentimentCls": sentiment_cls,
            "dotCls": dot_cls,
            "tags": tags_str
        }
        news_list.append(news_item)
        
    if producer:
        for news in news_list:
            producer.produce(
                TOPIC_NEWS,
                key="market_news",
                value=json.dumps(news)
            )
        producer.flush()
        print(f"Produced {len(news_list)} news items to Kafka.")

def run_scheduler():
    print("News fetcher scheduler started.")
    print("News will be fetched at 08:30, 11:30, and 16:15.")
    
    schedule.every().day.at("08:30").do(fetch_market_news)
    schedule.every().day.at("11:30").do(fetch_market_news)
    schedule.every().day.at("16:15").do(fetch_market_news)
    
    # Run once immediately so we have data
    fetch_market_news()
    
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    run_scheduler()
