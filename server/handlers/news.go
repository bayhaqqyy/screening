package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/sahamscreen/server/database"
)

type NewsItem struct {
	ID           int64  `json:"id"`
	Title        string `json:"title"`
	Link         string `json:"link"`
	Source       string `json:"source"`
	Sentiment    string `json:"sentiment"`
	SentimentCls string `json:"sentimentCls"`
	DotCls       string `json:"dotCls"`
	Tags         string `json:"tags"`
	Description  string `json:"description"`
	ImageURL     string `json:"image_url"`
	PublishedAt  string `json:"published_at"`
	CreatedAt    string `json:"created_at"`
}

func GetNews(w http.ResponseWriter, r *http.Request) {
	limit := r.URL.Query().Get("limit")
	if limit == "" {
		limit = "20"
	}

	sentiment := r.URL.Query().Get("sentiment")

	var rows_err error
	var newsItems []NewsItem

	if sentiment != "" {
		rows, err := database.DB.Query(`
			SELECT id, title, link, COALESCE(source,''), COALESCE(sentiment,'Neutral'),
			       COALESCE(sentiment_cls,''), COALESCE(dot_cls,''), COALESCE(tags,''),
			       COALESCE(description,''), COALESCE(image_url,''), 
			       COALESCE(published_at, created_at), created_at
			FROM news
			WHERE LOWER(sentiment) = LOWER($1)
			ORDER BY created_at DESC
			LIMIT $2
		`, sentiment, limit)
		rows_err = err
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var n NewsItem
				rows.Scan(&n.ID, &n.Title, &n.Link, &n.Source, &n.Sentiment,
					&n.SentimentCls, &n.DotCls, &n.Tags, &n.Description,
					&n.ImageURL, &n.PublishedAt, &n.CreatedAt)
				newsItems = append(newsItems, n)
			}
		}
	} else {
		rows, err := database.DB.Query(`
			SELECT id, title, link, COALESCE(source,''), COALESCE(sentiment,'Neutral'),
			       COALESCE(sentiment_cls,''), COALESCE(dot_cls,''), COALESCE(tags,''),
			       COALESCE(description,''), COALESCE(image_url,''), 
			       COALESCE(published_at, created_at), created_at
			FROM news
			ORDER BY created_at DESC
			LIMIT $1
		`, limit)
		rows_err = err
		if err == nil {
			defer rows.Close()
			for rows.Next() {
				var n NewsItem
				rows.Scan(&n.ID, &n.Title, &n.Link, &n.Source, &n.Sentiment,
					&n.SentimentCls, &n.DotCls, &n.Tags, &n.Description,
					&n.ImageURL, &n.PublishedAt, &n.CreatedAt)
				newsItems = append(newsItems, n)
			}
		}
	}

	if rows_err != nil || newsItems == nil {
		newsItems = []NewsItem{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newsItems)
}

func GetFeaturedNews(w http.ResponseWriter, r *http.Request) {
	var n NewsItem
	err := database.DB.QueryRow(`
		SELECT id, title, link, COALESCE(source,''), COALESCE(sentiment,'Neutral'),
		       COALESCE(sentiment_cls,''), COALESCE(dot_cls,''), COALESCE(tags,''),
		       COALESCE(description,''), COALESCE(image_url,''),
		       COALESCE(published_at, created_at), created_at
		FROM news
		ORDER BY created_at DESC
		LIMIT 1
	`).Scan(&n.ID, &n.Title, &n.Link, &n.Source, &n.Sentiment,
		&n.SentimentCls, &n.DotCls, &n.Tags, &n.Description,
		&n.ImageURL, &n.PublishedAt, &n.CreatedAt)

	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(nil)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(n)
}
