import feedparser
import schedule
import time
import json
import os
import sys
import hashlib
import logging
from datetime import datetime
from confluent_kafka import Producer
from ticker_list import get_ticker_codes

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
TOPIC_NEWS = "idx.news.updates"

# Track seen URLs to avoid duplicate publishes within this session
_seen_urls = set()

# Multiple Indonesian financial news RSS sources
RSS_SOURCES = [
    {
        "name": "CNBC Indonesia",
        "url": "https://www.cnbcindonesia.com/market/rss",
    },
    {
        "name": "Kontan Investasi",
        "url": "https://investasi.kontan.co.id/rss",
    },
    {
        "name": "CNN Ekonomi",
        "url": "https://www.cnnindonesia.com/ekonomi/rss",
    },
    {
        "name": "Antara Ekonomi",
        "url": "https://www.antaranews.com/rss/ekonomi-bisnis.xml",
    },
    {
        "name": "Investing.com ID",
        "url": "https://id.investing.com/rss/news_301.rss",
    },
]

# Load all valid tickers dynamically for tagging
try:
    VALID_TICKERS = get_ticker_codes()
    logging.info(f"Loaded {len(VALID_TICKERS)} tickers for news tagging")
except Exception as e:
    logging.error(f"Failed to load tickers: {e}")
    VALID_TICKERS = ["BBCA", "BBRI", "BMRI", "BBNI", "TLKM", "ASII", "GOTO", "AMMN", "BREN"]


# Extended Indonesian sentiment keywords
BULLISH_WORDS = [
    'naik', 'lonjak', 'rekor', 'cuan', 'laba', 'untung', 'positif',
    'akumulasi', 'meroket', 'terbang', 'menguat', 'rally', 'cerah',
    'optimis', 'surplus', 'tumbuh', 'melonjak', 'melejit', 'hijau',
    'tertinggi', 'breakout', 'bullish', 'upgrade', 'buy', 'beli',
    'dividen', 'right issue', 'buyback', 'akuisisi', 'ekspansi',
    'kenaikan', 'perbaikan', 'pemulihan', 'pertumbuhan',
]

BEARISH_WORDS = [
    'turun', 'anjlok', 'ambruk', 'rugi', 'negatif', 'distribusi',
    'lepas', 'jual', 'merah', 'longsor', 'melemah', 'terkoreksi',
    'pesimis', 'defisit', 'menyusut', 'jatuh', 'bearish', 'sell',
    'downgrade', 'terendah', 'tekanan', 'koreksi', 'penurunan',
    'pelemahan', 'susut', 'resesi', 'default', 'gagal bayar',
    'delisting', 'suspend', 'force sell',
]


def get_producer():
    try:
        return Producer({
            'bootstrap.servers': KAFKA_BROKER,
            'message.max.bytes': 1048576,
        })
    except Exception as e:
        print(f"Warning: Could not connect to Kafka broker {KAFKA_BROKER}: {e}")
        return None


def extract_tickers_from_text(text):
    """Extract known stock tickers from text."""
    text_upper = text.upper()
    words = set(text_upper.replace(',', ' ').replace('.', ' ').replace('-', ' ').split())
    found = [t for t in VALID_TICKERS if t in words]
    return found


def analyze_sentiment(title):
    """Simple keyword-based sentiment analysis for Indonesian financial news."""
    title_lower = title.lower()

    bullish_hits = sum(1 for w in BULLISH_WORDS if w in title_lower)
    bearish_hits = sum(1 for w in BEARISH_WORDS if w in title_lower)

    if bullish_hits > bearish_hits:
        score = min(0.5 + bullish_hits * 0.15, 1.0)
        return "bullish", round(score, 2)
    elif bearish_hits > bullish_hits:
        score = max(-0.5 - bearish_hits * 0.15, -1.0)
        return "bearish", round(score, 2)
    else:
        return "neutral", 0.0


def fetch_from_source(source):
    """Fetch news items from a single RSS source with error handling."""
    name = source["name"]
    url = source["url"]

    try:
        feed = feedparser.parse(
            url,
            agent="Mozilla/5.0 (compatible; SahamScreen/1.0; +https://sahamscreen.id)"
        )

        if feed.bozo and not feed.entries:
            print(f"  [{name}] Feed parse error: {getattr(feed, 'bozo_exception', 'Unknown')}")
            return []

        if not feed.entries:
            print(f"  [{name}] No entries found")
            return []

        items = []
        for entry in feed.entries[:10]:
            url_link = getattr(entry, 'link', '')

            # Dedup by URL
            if url_link in _seen_urls:
                continue
            _seen_urls.add(url_link)

            title = getattr(entry, 'title', 'Untitled')
            published = getattr(entry, 'published', datetime.now().isoformat())

            # Sentiment
            sentiment, sentiment_score = analyze_sentiment(title)

            # Ticker extraction
            found_tickers = extract_tickers_from_text(title)
            ticker_str = found_tickers[0] if found_tickers else ""

            items.append({
                "headline": title,
                "url": url_link,
                "source": name,
                "ticker": ticker_str,
                "timestamp": published,
                "sentiment": sentiment,
                "sentiment_score": sentiment_score,
            })

        print(f"  [{name}] Fetched {len(items)} new items")
        return items

    except Exception as e:
        print(f"  [{name}] Error: {e}")
        return []


def fetch_all_news():
    """Fetch news from all configured sources and publish to Kafka."""
    print(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] === Fetching news from {len(RSS_SOURCES)} sources ===")

    producer = get_producer()
    all_items = []

    for source in RSS_SOURCES:
        items = fetch_from_source(source)
        all_items.extend(items)
        # Small delay between sources to be polite
        time.sleep(1)

    if not all_items:
        print("No news items collected from any source.")
        return

    if producer:
        published_count = 0
        for news in all_items:
            try:
                producer.produce(
                    TOPIC_NEWS,
                    key=(news.get("ticker") or "market_news").encode('utf-8'),
                    value=json.dumps(news).encode('utf-8')
                )
                published_count += 1
            except Exception as e:
                print(f"  Failed to produce news item: {e}")
        producer.flush()
        print(f"Published {published_count}/{len(all_items)} news items to Kafka topic '{TOPIC_NEWS}'")
    else:
        print(f"Kafka unavailable — {len(all_items)} items fetched but not published")

    # Keep _seen_urls from growing unbounded (keep last 1000)
    if len(_seen_urls) > 1000:
        _seen_urls.clear()


def run_scheduler():
    print("=" * 60)
    print("SahamScreen News Fetcher v2.0")
    print(f"Kafka Broker: {KAFKA_BROKER}")
    print(f"Sources: {', '.join(s['name'] for s in RSS_SOURCES)}")
    print(f"Schedule: every 15 minutes")
    print("=" * 60)

    # Fetch immediately on startup
    fetch_all_news()

    schedule.every(15).minutes.do(fetch_all_news)

    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    run_scheduler()
