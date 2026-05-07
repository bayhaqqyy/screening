# Cloudflare Tunnel for SahamScreen Webhook

This service exposes the Go server's `/api/webhooks/tradingview/{token}`
endpoint to the public internet via a Cloudflare Tunnel — no port-forward,
no public IP, TLS terminated at Cloudflare's edge.

Public hostname (target): `webhook.bayhaqqy.my.id`

## One-time setup

### 1. Create the tunnel in Cloudflare Zero Trust dashboard

1. Go to <https://one.dash.cloudflare.com/> → **Networks → Tunnels → Create a tunnel**.
2. Choose **Cloudflared** connector.
3. Name it e.g. `sahamscreen-webhook` and click **Save tunnel**.
4. Cloudflare shows a **Tunnel token** (long string starting with `eyJ...`).
   Copy it — this is what `cloudflared` in docker-compose needs.
5. In **Public Hostnames**, click **Add a public hostname**:
   - Subdomain: `webhook`
   - Domain: `bayhaqqy.my.id`
   - Service type: `HTTP`
   - URL: `server:8088`
6. Save. Cloudflare automatically adds the DNS CNAME for you.

### 2. Provide the token to docker-compose

Add to your `.env` (next to `docker-compose.yml`):

```env
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi...your...token...
TV_WEBHOOK_PATH_TOKEN=<a long random string, e.g. 32 hex chars>
TV_WEBHOOK_SECRET=<another random string, used as body "secret" field>
```

Generate strong tokens:

```bash
# 32 hex chars (16 bytes) — used in the webhook URL TV calls
openssl rand -hex 16
# 32 hex chars — used as the body "secret" field
openssl rand -hex 16
```

Keep `TV_WEBHOOK_PATH_TOKEN` out of any public log / screenshot — anyone who
knows it can post fake alerts (the body `secret` is a second line of defense).

### 3. Bring it up

The `cloudflared` service is gated behind a docker-compose **profile** so it
does not start by default. Bring it up explicitly:

```bash
docker compose --profile tunnel up -d cloudflared
```

Verify:

```bash
docker logs -f sahamscreen-cloudflared
# Expect: "Connection registered" / "Registered tunnel connection"
```

Smoke test from anywhere on the internet:

```bash
curl https://webhook.bayhaqqy.my.id/api/webhooks/health
# {"status":"ok","service":"tradingview-webhook"}
```

## TradingView alert configuration

In the TradingView alert dialog set **Notifications → Webhook URL**:

```
https://webhook.bayhaqqy.my.id/api/webhooks/tradingview/<TV_WEBHOOK_PATH_TOKEN>
```

Set the **Message** body to the JSON template documented in
[`../tradingview/alert-template.json`](../tradingview/alert-template.json).

## Hardening checklist (do this in Cloudflare dashboard)

- **Security → WAF → Custom rules**: only allow `POST` on path
  `/api/webhooks/tradingview/*` for the TradingView source IPs:
  `52.89.214.238`, `34.212.75.30`, `54.218.53.128`, `52.32.178.7`.
  Deny everything else on this hostname.
- **Security → Rate Limiting**: 60 requests / minute / IP on
  `webhook.bayhaqqy.my.id`.
- **SSL/TLS**: Full (strict) is fine even though the origin is plain HTTP
  inside the docker network — the tunnel itself is TLS to Cloudflare.
- **Security → Bots**: enable Bot Fight Mode.
- **Caching**: bypass cache for `/api/webhooks/*` (avoid replaying alerts).

## Local development without a permanent tunnel

For one-off testing without going through the Zero Trust dashboard:

```bash
cloudflared tunnel --url http://localhost:8088
```

Cloudflare prints a random `*.trycloudflare.com` URL you can paste into a
TradingView test alert. The URL changes every time you restart this command.

## Rotating the token

1. Generate a new `TV_WEBHOOK_PATH_TOKEN`.
2. Update `.env` and `docker compose up -d server`.
3. Update the webhook URL in every TradingView alert that points here.
4. Keep the old token live for ~24 h to drain in-flight alerts, then remove.

The Cloudflare Tunnel token itself can be rotated from the same Zero Trust
**Tunnels** page (Configure → "Reset token").
