# Notification Engine

An internal service that converts platform events into Microsoft Teams notifications. Internal systems POST events to one endpoint; the engine routes them through configurable rules, renders them against templates, and sends them as a delegated proxy user via Microsoft Graph.

---

## Table of contents

1. [How to deploy](#1-how-to-deploy)
2. [How to add a source](#2-how-to-add-a-source)
3. [How to add a recipient](#3-how-to-add-a-recipient)
4. [How to write a template](#4-how-to-write-a-template)
5. [How to add a routing rule](#5-how-to-add-a-routing-rule)
6. [How to read the audit log](#6-how-to-read-the-audit-log)
7. [How to rotate the proxy account](#7-how-to-rotate-the-proxy-account)
8. [Environment reference](#8-environment-reference)
9. [API quick reference](#9-api-quick-reference)

---

## 1. How to deploy

### Prerequisites

- Docker and Docker Compose (Docker Engine 24+ recommended).
- Network access to `login.microsoftonline.com` and `graph.microsoft.com` from the host (required for MSAL token acquisition and Microsoft Graph sends).
- The Entra app registration is already created. The default `ENTRA_CLIENT_ID` and `ENTRA_TENANT_ID` values in `.env.example` point at the org's existing registration with delegated scopes `Chat.Create` and `ChatMessage.Send`.

### Steps

**1. Clone and enter the directory.**

```bash
git clone <repo-url>
cd notification-engine
```

**2. Create the environment file.**

```bash
cp .env.example .env
```

Edit `.env` and fill in every `CHANGE_ME` value:

| Variable         | What to set                                                          |
| ---------------- | -------------------------------------------------------------------- |
| `DB_PASSWORD`    | Any strong random password for the Postgres `notif` user             |
| `DATABASE_URL`   | Uses the value above: `postgres://notif:<DB_PASSWORD>@db:5432/notif` |
| `ADMIN_PASSWORD` | The password you will use to log into the admin UI                   |
| `JWT_SECRET`     | At least 32 random bytes, e.g. `openssl rand -hex 32`                |

`ENTRA_CLIENT_ID` and `ENTRA_TENANT_ID` already have the correct defaults and do not need to change.

**3. Build and start.**

```bash
docker compose up -d --build
```

The app container runs database migrations automatically on startup (via `docker-entrypoint.sh`), then starts the Express server. The React frontend is served from the same process.

**4. Verify the engine is healthy.**

```bash
curl http://localhost:5000/api/health
# {"ok":true,"db":"up","msal":"signed_out"}
```

`db` should be `up`. `msal` will be `signed_out` until you sign in the proxy account (see [section 7](#7-how-to-rotate-the-proxy-account)).

**5. Open the admin UI.**

Navigate to `http://localhost:5000` in a browser. Log in with the username and password set in `.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`; defaults: `admin` / `admin123`).

**6. Sign in the proxy account.**

The engine cannot send Teams messages until the proxy user's MSAL token is cached. Follow [section 7](#7-how-to-rotate-the-proxy-account) to complete this step.

### Port

The internal port defaults to `5000`. To change it, set `PORT=<number>` in `.env`. docker-compose maps `host:PORT -> container:PORT` automatically, so `PORT=8080` in `.env` exposes the service on `host:8080`.

### Named volumes

| Volume                     | Purpose                              |
| -------------------------- | ------------------------------------ |
| `notification-engine-data` | Postgres data — do not delete        |
| `notification-engine-msal` | MSAL token cache — survives restarts |

### Stopping and upgrading

```bash
# Stop without destroying data
docker compose down

# Rebuild after a code change
docker compose up -d --build

# Full teardown including volumes (destroys all data)
docker compose down -v
```

---

## 2. How to add a source

A **source** represents an internal system that will send events to the engine. Each source has its own API key and an optional per-source rate limit.

### Via the admin UI

1. In the sidebar, click **Sources**.
2. Click **New source**.
3. Enter a display name (e.g. `Zabbix`, `BI Jobs`) and an optional rate limit in requests per minute (default: 60).
4. Click **Create**.
5. The full API key is shown **once** in the success banner. Copy it immediately — it is never shown again. The UI only shows the first 8 characters (the prefix) from that point on.

### Via the API

```bash
curl -X POST http://localhost:5000/api/admin/sources \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Zabbix", "rate_limit_rpm": 120}'
```

Response:

```json
{
  "id": "src_01HXY...",
  "name": "Zabbix",
  "api_key": "sk_live_abc123...",
  "api_key_prefix": "sk_live_a",
  "rate_limit_rpm": 120,
  "active": true,
  "created_at": "..."
}
```

`api_key` is included only in the creation response. Store it securely — configure your sender system to pass it as the `X-API-Key` header on every request.

### Revoking a source

Deactivating a source in the UI (`active = false`) immediately stops the engine from accepting its requests without deleting the audit history. To permanently remove a source, delete it from the Sources page — this cascades to delete its routing rules but leaves audit records intact (the `source_id` foreign key on `notifications` is set-null on delete).

---

## 3. How to add a recipient

Recipients are the people or Teams channels that groups can target. There are two kinds.

### Users (Teams user, messaged 1-on-1)

1. In the sidebar, click **Recipients > Users**.
2. Click **Add user**.
3. Enter a display name and the user's UPN (email address), e.g. `alice@yourorg.com`.
4. Optionally paste the user's Entra object ID (`aad_user_id`). If left blank, the engine resolves it the first time it needs to create a chat with that user.
5. Click **Save**.

Via the API:

```bash
curl -X POST http://localhost:5000/api/admin/recipients/users \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"display_name": "Alice", "upn": "alice@yourorg.com"}'
```

### Channels (Teams channel)

1. In the sidebar, click **Recipients > Channels**.
2. Click **Add channel**.
3. Enter a display name, the `team_id`, and the `channel_id`.

To find these IDs: open Teams, navigate to the channel, click the `...` menu, and choose **Get link to channel**. The link contains both IDs in the query string.

4. Click **Save**.

Via the API:

```bash
curl -X POST http://localhost:5000/api/admin/recipients/channels \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "Ops Alerts",
    "team_id": "19:...",
    "channel_id": "19:..."
  }'
```

The proxy user must be a member of the target team for channel sends to succeed. Add the proxy account to the team in the Teams client before routing notifications to any of its channels.

---

## 4. How to write a template

Templates define how the notification body is rendered from the incoming payload. A single template can serve many routing rules.

### Template kinds

| Kind            | What it renders                                       |
| --------------- | ----------------------------------------------------- |
| `text_html`     | An HTML message body sent as the chat message content |
| `adaptive_card` | An Adaptive Card attachment (JSON)                    |
| `image`         | Used to attach an inline image via `hostedContents`   |

### Variable substitution

Use `{{var}}` placeholders in the template body. The substitution is a minimal mustache-style pass: dot notation for nested fields (`{{data.kpi}}`), no conditionals, no loops.

Available variables come from the inbound notification payload:

| Variable         | Source                          |
| ---------------- | ------------------------------- |
| `{{title}}`      | `payload.title`                 |
| `{{body}}`       | `payload.body`                  |
| `{{severity}}`   | `payload.severity`              |
| `{{event_type}}` | `payload.event_type`            |
| `{{data.*}}`     | Any field inside `payload.data` |

### Creating a text_html template

```bash
curl -X POST http://localhost:5000/api/admin/templates \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alarm alert",
    "kind": "text_html",
    "body": "<p><strong>{{title}}</strong></p><p>{{body}}</p><p>Severity: {{severity}}</p>"
  }'
```

### Creating an adaptive card template

The `body` field is a JSON string representing the Adaptive Card schema. Use `{{var}}` placeholders inside JSON string values.

```bash
curl -X POST http://localhost:5000/api/admin/templates \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "KPI card",
    "kind": "adaptive_card",
    "body": "{\"type\":\"AdaptiveCard\",\"version\":\"1.4\",\"body\":[{\"type\":\"TextBlock\",\"text\":\"{{title}}\",\"weight\":\"bolder\",\"size\":\"medium\"},{\"type\":\"TextBlock\",\"text\":\"{{body}}\",\"wrap\":true}]}"
  }'
```

### Enforcing required variables with vars_schema

If a template requires specific payload fields, set `vars_schema` to a JSON Schema describing them. If the inbound payload does not satisfy the schema, the delivery for that recipient is marked `failed` with `last_error` containing `template_validation`, and the engine continues sending to other recipients unaffected.

```json
{
  "name": "KPI strict",
  "kind": "text_html",
  "body": "KPI value: {{data.kpi}}%",
  "vars_schema": {
    "required": ["data.kpi"]
  }
}
```

### Previewing a template

Use the template preview endpoint to test rendering against a sample payload before wiring the template into a rule:

```bash
curl -X POST http://localhost:5000/api/admin/templates/<id>/preview \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Revenue dropped",
    "body": "Down 30% vs last hour.",
    "data": { "kpi": "70" }
  }'
```

The admin UI template editor has a live preview panel; use it to iterate before saving.

### The default template

The engine ships with a built-in default template used when a routing rule has no `template_id`. It renders `{{title}}` and `{{body}}` as plain HTML. This lets you wire up a new source without authoring a template first.

---

## 5. How to add a routing rule

A routing rule binds a source and an event-type pattern to a group and a template. When a notification arrives, the engine evaluates all active rules for that source and fires every matching rule independently.

### Event-type patterns

- **Exact match**: `alarm.critical` — matches only `alarm.critical`.
- **Trailing wildcard**: `alarm.*` — matches `alarm.critical`, `alarm.degraded`, `alarm.recovery`, and any other string starting with `alarm.`.

There are no regexes, no multi-level wildcards, and no precedence rules. Every matching rule fires.

### Creating a rule

```bash
curl -X POST http://localhost:5000/api/admin/rules \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "src_01HXY...",
    "event_pattern": "alarm.*",
    "group_id": "grp_01HXY...",
    "template_id": "tpl_01HXY...",
    "priority": 100
  }'
```

`template_id` is optional — if omitted, the default template is used. `priority` is stored but does not currently affect dispatch order; all matching rules fire in parallel.

### Via the admin UI

1. In the sidebar, click **Rules**.
2. Click **New rule**.
3. Select the source, enter the event pattern, select the target group, and optionally select a template.
4. Click **Save**.

### Multi-group fan-out

To send the same event to multiple groups, create one rule per group with the same `source_id` and `event_pattern`. The engine de-duplicates recipients across rules so no person receives the same notification twice.

### Unrouted notifications

If no rule matches an incoming notification, the engine still persists the record with `status = unrouted`. The Dashboard surfaces these so you can decide whether to add a rule or ignore them.

---

## 6. How to read the audit log

Every inbound request and every per-recipient send attempt is recorded. The audit log is the primary tool for troubleshooting delivery failures.

### Notification statuses

| Status     | Meaning                                          |
| ---------- | ------------------------------------------------ |
| `queued`   | Received; dispatch has not started yet           |
| `sending`  | Dispatch is in progress                          |
| `sent`     | All recipients received the message successfully |
| `partial`  | Some recipients succeeded, some failed           |
| `failed`   | Every delivery attempt failed                    |
| `unrouted` | No routing rule matched; nothing was sent        |

### Delivery statuses

| Status     | Meaning                                                          |
| ---------- | ---------------------------------------------------------------- |
| `queued`   | Waiting for the first send attempt                               |
| `sent`     | Message delivered to this recipient                              |
| `failed`   | All retry attempts exhausted                                     |
| `retrying` | A retryable failure occurred; the retry worker will pick this up |

### Browsing the log in the UI

1. In the sidebar, click **Notifications**.
2. Use the filter bar to narrow by status, source, event type, or date range.
3. Click any row to open the detail view: full raw payload, matched rules, and a per-recipient delivery list with attempt count, last error, and timestamps.

### Browsing via API

```bash
# List notifications — filter by status and event type
curl "http://localhost:5000/api/admin/notifications?status=failed&event_type=alarm.*" \
  -H "Authorization: Bearer <admin-jwt>"

# Fetch one notification with its deliveries
curl "http://localhost:5000/api/admin/notifications/ntf_01HXY..." \
  -H "Authorization: Bearer <admin-jwt>"
```

### Retrying failed deliveries

**Single delivery retry** — resets `attempts` to 0 and sets `status = retrying`. The retry worker picks it up within 30 seconds.

```bash
curl -X POST http://localhost:5000/api/admin/deliveries/<delivery-id>/retry \
  -H "Authorization: Bearer <admin-jwt>"
```

**Bulk retry** — resets all `failed` deliveries on a notification at once.

```bash
curl -X POST http://localhost:5000/api/admin/notifications/<notification-id>/retry \
  -H "Authorization: Bearer <admin-jwt>"
```

In the admin UI, both buttons appear on the notification detail page.

### Retry policy

The in-process retry worker runs every 30 seconds. For each delivery in `retrying` with `attempts < 5`, it waits at least `30s × 2^attempts` since the last attempt before retrying. After 5 attempts, the delivery is permanently `failed`. Manual retries reset the counter.

---

## 7. How to rotate the proxy account

All Teams messages are sent "from" a single proxy user (delegated auth via Microsoft Graph). The MSAL token cache is persisted in the `notification-engine-msal` Docker volume at `/data/msal/.msal-cache.json`.

### First sign-in after deploy

The engine boots with `msal: signed_out` until you complete the device-code flow once.

1. Open the admin UI and navigate to **Settings**.
2. In the **Proxy account** panel, click **Sign in**.
3. The panel shows a verification URL and a short device code.
4. On any device, open the verification URL (e.g. `https://microsoft.com/devicelogin`), enter the code, and sign in as the proxy user (`proxy@email.com` or whichever account has the delegated permissions).
5. The admin UI polls the server until the cache is populated and then shows the signed-in account name and UPN.

From this point the engine can send messages. The token is refreshed silently; you do not need to repeat the device-code flow unless the refresh token expires (typically 90 days of inactivity) or you deliberately sign out.

### Rotating to a different proxy account

1. Go to **Settings** in the admin UI.
2. Click **Sign out**. This clears the MSAL cache and stops all sends until a new sign-in is complete.
3. Click **Sign in** and follow the device-code flow with the new proxy account.
4. Confirm the new account name appears in the panel.

After rotation, the `proxy_account` table row is updated with the new account's UPN and Entra object ID. All future sends use the new account.

### If the cache is lost (volume deleted)

If the `notification-engine-msal` volume is deleted, the cache is gone and the engine returns to `signed_out`. Repeat the first sign-in steps above. No data is lost in Postgres; only the MSAL token cache is affected.

### Checking sign-in status without the UI

```bash
curl http://localhost:5000/api/health
# {"ok":true,"db":"up","msal":"signed_in"}

curl http://localhost:5000/api/admin/proxy-account \
  -H "Authorization: Bearer <admin-jwt>"
# {"upn":"proxy@email.com","display_name":"...","status":"signed_in","last_sign_in_at":"..."}
```

---

## 8. Environment reference

All configuration lives in `.env` at the project root (docker-compose) or `backend/.env` (local development without Docker). Never put secrets in code.

| Variable              | Default        | Required in prod         | Notes                                                              |
| --------------------- | -------------- | ------------------------ | ------------------------------------------------------------------ |
| `NODE_ENV`            | `development`  | Yes, set to `production` | Enables frontend serving and stricter mode                         |
| `PORT`                | `5000`         | No                       | Internal app port; docker-compose maps it to the host 1:1          |
| `DATABASE_URL`        | —              | Yes                      | `postgres://notif:<DB_PASSWORD>@db:5432/notif`                     |
| `DB_PASSWORD`         | —              | Yes                      | Postgres `notif` user password                                     |
| `ENTRA_CLIENT_ID`     | `5935a6c7-...` | No                       | Entra app registration client ID                                   |
| `ENTRA_TENANT_ID`     | `a7853600-...` | No                       | Entra tenant ID                                                    |
| `MSAL_CACHE_DIR`      | `/data/msal`   | No                       | Directory where `.msal-cache.json` is written                      |
| `ADMIN_USERNAME`      | `admin`        | No                       | Admin UI login username                                            |
| `ADMIN_PASSWORD`      | `admin123`     | **Change this**          | Admin UI login password — plaintext in env, constant-time compared |
| `JWT_SECRET`          | auto-generated | Yes                      | HS256 signing secret for admin JWTs; must be ≥32 random bytes      |
| `DEFAULT_SOURCE_RPM`  | `60`           | No                       | Default rate limit for new sources (requests per minute)           |
| `RETRY_MAX_ATTEMPTS`  | `5`            | No                       | Max delivery retry attempts before marking a delivery `failed`     |
| `RETRY_BASE_DELAY_MS` | `30000`        | No                       | Base delay for exponential backoff: `base × 2^attempts`            |

Generate a strong `JWT_SECRET`:

```bash
openssl rand -hex 32
```

---

## 9. API quick reference

### Ingestion (API-key auth)

```
POST /api/notifications      Submit a notification event; returns 202
GET  /api/health             Liveness check; returns DB and MSAL status
```

**Inbound payload shape:**

```json
{
  "event_type": "kpi.degraded",
  "title": "Revenue KPI dropped 30%",
  "body": "Investigation started.",
  "severity": "high",
  "data": {},
  "attachments": [
    { "kind": "image", "filename": "chart.png", "base64": "..." }
  ],
  "template_override": "kpi-card-v2"
}
```

Only `event_type` is required. Pass the source's API key as `X-API-Key`.

**202 response:**

```json
{
  "notification_id": "ntf_01HXY...",
  "matched_groups": ["Ops", "On-Call"],
  "queued_deliveries": 5
}
```

### Admin auth

```
POST /api/admin/auth/login     { username, password } -> { token, expires_at }
GET  /api/admin/auth/me        -> { username }
```

All `/api/admin/*` routes except `/auth/login` require `Authorization: Bearer <token>`.

### Admin CRUD (all require Bearer token)

```
GET/POST/PUT/DELETE  /api/admin/sources
GET/POST/PUT/DELETE  /api/admin/recipients/users
GET/POST/PUT/DELETE  /api/admin/recipients/channels
GET/POST/PUT/DELETE  /api/admin/groups
POST/DELETE          /api/admin/groups/:id/members
GET/POST/PUT/DELETE  /api/admin/templates
POST                 /api/admin/templates/:id/preview
GET/POST/PUT/DELETE  /api/admin/rules
GET                  /api/admin/proxy-account
POST                 /api/admin/proxy-account/sign-in
POST                 /api/admin/proxy-account/sign-out
GET                  /api/admin/notifications
GET                  /api/admin/notifications/:id
POST                 /api/admin/notifications/:id/retry
POST                 /api/admin/deliveries/:id/retry
GET                  /api/admin/stats
```

### End-to-end smoke test

A QA script covering all critical paths (routing, fan-out, de-dup, image, adaptive card, template validation failure, manual retry, audit detail) is included:

```bash
BASE_URL=http://localhost:5000 bash qa/qa-script.sh
```

The script creates its own source, recipients, groups, templates, and rules — safe to run against a fresh or existing deployment.
