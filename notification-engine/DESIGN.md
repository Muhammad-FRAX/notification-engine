# Notification Engine — DESIGN.md

Status: DRAFT
Owner: Mohamed Ali (lordraxos@gmail.com)
Working MVP reference: [delegated.js](../delegated.js), [delegated-image.js](../delegated-image.js)

---

## 1. Purpose

The Notification Engine is a central layer that converts operational platform events (alarms, incidents, KPI degradations, service changes, daily summaries) into structured Teams notifications. Internal systems POST to one endpoint; the engine decides who should receive what, formats the message, sends it through Microsoft Graph as a delegated proxy user, and records the outcome.

Out of band: this is an internal tool for one organization. The admin UI is used by operators (not end users). End users only receive Teams messages.

---

## 2. Goals and non-goals

**Goals**

- One ingestion endpoint that accepts any source (Zabbix, internal BI jobs, monitoring scripts, ad-hoc curl).
- Flexible routing: a single sender can fan a notification out to many groups based on the kind of event.
- Three message kinds at MVP: HTML text, image, adaptive card. All three must compose (text + image + card on the same message).
- Targets: Teams users and Teams channels, addressable individually or via reusable groups.
- Full audit: every received request and every per-recipient send attempt is persisted with success or failure detail.
- Failure visibility: the admin UI surfaces failed sends and supports manual retry.
- Admin UI manages everything: proxy account sign-in, sources, recipients, groups, templates, routing rules, audit log.
- Two-container deploy: app + Postgres. No microservices.
- Free stack: Microsoft Graph + MSAL + the existing M365 licenses. No paid services.

**Non-goals (MVP)**

- Receiving messages from Teams or two-way conversations. The receiver flow is blocked on tenant admin consent for `Chat.Read`; defer until that consent is granted. When it is, the receiver lives as a separate process, not part of the engine.
- A real Teams bot (Bot Framework). This engine sends as a proxy user, not as a bot identity. Switching to a bot is a future migration.
- Multi-tenancy. One tenant, one proxy user, one engine instance.
- Channel posting from app-only context. Channels are sent to using the same delegated user (must be a member of the team).

---

## 3. Core mental model

Everything routes through one orchestrator. The HTTP layer is a thin door.

```
External system
      |
      v
POST /api/notifications  (api key + event_type + payload)
      |
      v
notification.controller  -- validates request, returns 202 fast
      |
      v
notification.service     -- the orchestrator
      |
      +--> routing.service     resolves (source, event_type) -> rules
      +--> template.service    renders the chosen template with payload vars
      +--> audience.service    expands groups into a flat list of recipients
      +--> graph.service       sends via Microsoft Graph (uses cached MSAL token)
      +--> audit.service       persists notification + per-recipient deliveries
```

The controller never calls another route. There is no internal HTTP. Service functions are imported directly.

---

## 4. Routing model (the contract)

A sender system holds an API key. The payload always includes an `event_type`. The engine looks up routing rules keyed on `(source_id, event_type)` and dispatches to every group matched.

### 4.1 Inbound request shape

```
POST /api/notifications
Headers:
  X-API-Key: <opaque token>
  Content-Type: application/json

Body:
{
  "event_type": "kpi.degraded",         // required, free-form dotted name
  "title": "Revenue KPI dropped 30%",   // optional, used by default template
  "body": "Investigation started ...",  // optional, plain text or html
  "severity": "high",                   // optional, free-form
  "data": { ... },                      // optional, arbitrary json passed to template vars
  "attachments": [                      // optional
    { "kind": "image", "filename": "chart.png", "base64": "..." }
  ],
  "template_override": "kpi-card-v2"    // optional, force a specific template
}
```

Response 202:
```
{
  "notification_id": "ntf_01HXYZ...",
  "matched_groups": ["CTO+Ops", "On-Call"],
  "queued_deliveries": 7
}
```

Validation is light. The engine accepts anything that has an `event_type`. Rule resolution decides whether anything happens with it.

**Request body size.** No effective cap. Express body parser is configured with `limit: '1gb'` so attachments of any reasonable size pass through. We accept the trade: the audit table grows in proportion to attachment size (payload is stored verbatim), and a malicious sender with a valid API key can submit very large bodies that consume memory during parse. Mitigations: API keys are per-source (revocable in the UI), per-source rate-limit caps the request rate, and operationally the engine sits behind the org's internal network — not on the public internet.

### 4.2 Routing rule

A rule is `(source_id, event_type_pattern, group_id, template_id, priority, active)`.

- `event_type_pattern` supports an exact match or a single trailing `*` wildcard (`kpi.*` matches `kpi.degraded` and `kpi.recovered`). No regex, no precedence trickery.
- A single notification may match multiple rules. Every matched rule produces an independent send to its group. Duplicate recipients across groups are de-duplicated per notification (the same person does not get the same message twice).
- If zero rules match, the notification is persisted with status `unrouted` and surfaced in the UI. It is not an error.

### 4.3 Why this shape

- Sources are first-class: the audit log always knows "Zabbix said X at 14:02", not "someone with the shared key said X".
- Event types are free-form strings the sender owns. Adding a new event type does not require a code change in the engine.
- Routing rules are data, edited in the UI. The engine itself has no hardcoded mapping.
- Templates are decoupled from rules: the same template can serve many rules; the same rule can swap templates without losing history.

---

## 5. Message kinds and template system

Three template kinds at MVP. A single message can include all three components.

| Kind            | What it produces                                   | Storage                          |
|-----------------|----------------------------------------------------|----------------------------------|
| `text_html`     | The `body.content` HTML string of the chat message | Handlebars-like string template  |
| `image`         | A `hostedContents` entry plus an `<img>` reference | Image source: filesystem or inline base64 from payload |
| `adaptive_card` | An attachment with `application/vnd.microsoft.card.adaptive` | JSON template with `{{var}}` placeholders |

A template row is:

- `id`, `name`, `kind`, `body` (string for html, json string for card), `vars_schema` (json schema describing required payload fields), `version`, `active`.

Rendering:

- Use a minimal mustache-style substitution (`{{var}}`, `{{data.kpi}}`). No conditionals, no loops. Anything more complex belongs in the sender.
- If `vars_schema` validation fails, the render is rejected and the per-recipient delivery row is marked `failed` with reason `template_validation`. The notification continues for other rules.

Composition: when a rule's template is `adaptive_card`, the engine produces an HTML body of `<attachment id="1"></attachment>` and a single attachment entry. When the inbound payload also contains an image attachment, the engine appends `<img src="../hostedContents/1/$value"/>` to the HTML body and adds a `hostedContents` entry — mirroring the working pattern in [delegated-image.js](../delegated-image.js).

A "default" template ships with the engine for every event_type with no template configured, so an admin can wire up a new source without writing a template first.

---

## 6. Identity, auth, and the MSAL cache

There are two distinct identity surfaces. Do not confuse them.

### 6.1 Outbound (Microsoft Graph) — the proxy user

This is exactly the flow in [delegated.js](../delegated.js).

- One Entra app registration (public client), with delegated scopes: `Chat.Create`, `ChatMessage.Send`.
- One real user (the "proxy account") signs in once via device code. Their MSAL token cache is persisted to disk and reused.
- Every Teams send is "from" that proxy user. End users see this account as the sender.

The cache lives at a path the container can write to — mounted as a volume so it survives restarts. Default path: `${MSAL_CACHE_DIR}/.msal-cache.json`. Default `MSAL_CACHE_DIR=/data/msal`.

The admin UI exposes:

- The currently-signed-in account (UPN, display name, last refresh time).
- A "Sign in / re-authenticate" button. Clicking it triggers the device-code flow on the server, streams the verification URL + code back to the UI (SSE or short polling), and polls until tokens are cached. Then the UI shows the new account.
- A "Sign out" button that clears the cache.

There is no hardcoded `SENDER_USER_ID` in production code. The engine reads the signed-in account from the MSAL cache at startup and stores its `oid` in a single-row `proxy_account` table. If the cache is empty, the engine still boots; the admin UI shows "Not signed in" and ingestion endpoints return 503 for sends until sign-in completes (but the request is still persisted so nothing is lost).

### 6.2 Inbound (sender systems) — API keys

- Each `sources` row has an `api_key_hash` (argon2 or bcrypt) and an `api_key_prefix` (first 8 chars, shown in the UI for identification).
- The full key is shown to the admin **once** at creation time and never stored.
- Requests authenticate via `X-API-Key`. Constant-time comparison on the hash.
- Per-source rate limit (default 60/min, configurable per row).

### 6.3 Inbound (admin UI) — operator auth

JWT in the `Authorization: Bearer <token>` header. No cookies, so no CSRF surface.

- **Single admin account, configured via env.** `ADMIN_USERNAME` and `ADMIN_PASSWORD`. If either is unset, defaults to `admin` / `admin123` — first-boot ergonomics for local dev; **change before any deploy that is not your laptop**.
- **Login.** `POST /api/admin/auth/login` accepts `{ username, password }`, constant-time-compares against env, returns `{ token, expires_at }`. Token TTL: 7 days (one admin, manual rotation is fine).
- **Auth middleware.** All `/api/admin/*` routes except `/auth/login` require a valid Bearer token. Verifies signature + expiry; rejects with 401 otherwise.
- **Signing.** HS256 via `jsonwebtoken`. Signed with `JWT_SECRET` env var. If unset, the engine generates a random secret at boot and logs a warning — tokens will not survive a restart, which is fine for dev. Production must set `JWT_SECRET` to a stable random string (≥32 bytes).
- **Logout.** No server-side endpoint. The frontend discards the token from localStorage. (Stateless JWT means there is nothing to revoke without adding a server-side blacklist; out of scope for one admin.)
- **Brute-force protection.** The login route keeps the `authLimiter` rate-limit (5 attempts per minute per IP) already wired in the Express bootstrap template — meaningful even before the default password is changed.

Microsoft SSO via the engine's Entra app is the natural future move (delegated `User.Read`), but it adds friction (admin consent) and is not on the MVP critical path.

---

## 7. Data model

PostgreSQL. All ids are ULIDs as text (`ntf_01HXYZ...`) for sortable, debuggable identifiers.

```
sources
  id              text pk
  name            text not null
  api_key_hash    text not null
  api_key_prefix  text not null
  rate_limit_rpm  int  not null default 60
  active          bool not null default true
  created_at      timestamptz not null default now()
  last_used_at    timestamptz

recipients_users
  id              text pk
  display_name    text not null
  upn             text not null unique
  aad_user_id     text         unique   -- Entra object id; nullable until resolved
  notes           text
  created_at      timestamptz not null default now()

recipients_channels
  id              text pk
  display_name    text not null         -- "Ops / Alerts"
  team_id         text not null
  channel_id      text not null
  notes           text
  created_at      timestamptz not null default now()
  unique(team_id, channel_id)

groups
  id              text pk
  name            text not null unique
  description     text
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()

group_members
  id              text pk
  group_id        text not null references groups(id) on delete cascade
  member_type     text not null check (member_type in ('user','channel'))
  member_id       text not null         -- references recipients_users.id or recipients_channels.id
  created_at      timestamptz not null default now()
  unique(group_id, member_type, member_id)

templates
  id              text pk
  name            text not null
  kind            text not null check (kind in ('text_html','image','adaptive_card'))
  body            text not null         -- string for html/image, json string for card
  vars_schema     jsonb                 -- optional JSON schema
  version         int  not null default 1
  active          bool not null default true
  created_at      timestamptz not null default now()
  updated_at      timestamptz not null default now()

routing_rules
  id              text pk
  source_id       text not null references sources(id) on delete cascade
  event_pattern   text not null         -- exact or trailing-wildcard, e.g. 'kpi.*'
  group_id        text not null references groups(id) on delete restrict
  template_id     text references templates(id) on delete set null
  priority        int  not null default 100
  active          bool not null default true
  created_at      timestamptz not null default now()

notifications
  id              text pk
  source_id       text references sources(id) on delete set null
  event_type      text not null
  payload         jsonb not null
  received_at     timestamptz not null default now()
  status          text not null         -- 'queued','sending','sent','partial','failed','unrouted'
  matched_rules   jsonb                 -- array of rule ids
  recipient_count int  not null default 0
  error           text

notification_deliveries
  id              text pk
  notification_id text not null references notifications(id) on delete cascade
  rule_id         text references routing_rules(id) on delete set null
  group_id        text references groups(id) on delete set null
  recipient_type  text not null check (recipient_type in ('user','channel'))
  recipient_id    text not null
  status          text not null         -- 'queued','sent','failed','retrying'
  attempts        int  not null default 0
  last_error      text
  graph_chat_id   text                  -- for user sends
  graph_message_id text
  sent_at         timestamptz
  created_at      timestamptz not null default now()
  index (notification_id), index (status), index (created_at desc)

proxy_account                             -- single row
  id              int  pk default 1
  upn             text
  aad_user_id     text
  display_name    text
  cache_path      text
  last_sign_in_at timestamptz
  status          text                  -- 'signed_in','signed_out','expired'
  check (id = 1)
```

Migration tool: `node-pg-migrate` (zero-config, plays well with the existing `type: module` package). Migrations live in `backend/migrations/`.

---

## 8. API surface

### 8.1 Ingestion (public, API-key auth)

```
POST /api/notifications              accept a notification, return 202
GET  /api/notifications/:id          fetch one (debug, same key required)
GET  /api/health                     liveness; checks DB + MSAL cache presence
```

### 8.2 Admin API (session-cookie auth, all under /api/admin)

```
POST /api/admin/auth/login        -> { token, expires_at }
GET  /api/admin/auth/me           -> { username }   (verifies the Bearer token)

GET    /api/admin/proxy-account
POST   /api/admin/proxy-account/sign-in           -> returns { verification_uri, user_code }, server polls
POST   /api/admin/proxy-account/sign-out

CRUD   /api/admin/sources               create returns the full api key once
CRUD   /api/admin/recipients/users
CRUD   /api/admin/recipients/channels
CRUD   /api/admin/groups                + /:id/members POST/DELETE
CRUD   /api/admin/templates             + /:id/preview POST  -> renders against a sample payload
CRUD   /api/admin/rules

GET    /api/admin/notifications         filter by status, source, event_type, date range
GET    /api/admin/notifications/:id     full payload + deliveries
POST   /api/admin/notifications/:id/retry           retry every failed delivery
POST   /api/admin/deliveries/:id/retry              retry one delivery

GET    /api/admin/stats                 counts for the dashboard
```

REST shape, JSON in, JSON out. No GraphQL. No tRPC. Express 5 routers.

---

## 9. Failure handling and retries

A delivery can fail because: token expired, recipient not in tenant, throttled (HTTP 429), template render error, transient network.

Engine policy:

- Synchronous attempt at request time. If it succeeds, the delivery row is `sent`. If it fails for a known-retryable reason (429, 5xx, network), the row goes to `retrying` with `attempts=1`.
- A background worker (in-process `setInterval`, every 30s) picks up rows in `retrying` with `attempts < 5` and an exponential backoff (`30s * 2^attempts`).
- After 5 attempts, the row is `failed` with `last_error` set.
- The parent `notifications.status` is computed: all sent -> `sent`; some sent, some failed -> `partial`; none sent -> `failed`; no rule matched -> `unrouted`.
- Manual retry buttons in the UI reset `attempts` to 0 and put the row back to `retrying`.

No Redis, no BullMQ. If volume grows past the point a single-process worker can handle (hundreds of sends per minute), revisit. The boundary is documented; the migration is mechanical.

---

## 10. Frontend

React 19 + Vite + TypeScript. The scaffold is already there; add TS via `npm install -D typescript @types/node` and rename files as they get touched (no big-bang conversion).

### 10.1 Design system

Per the brief: modern, smooth, professional. Dark by default, light available, purple accent, smaller controls, readable but not chunky.

**Approach.** Tailwind CSS for utilities, shadcn/ui (Radix primitives + Tailwind) for components — these are copied into the repo (`frontend/src/components/ui/`), not installed as a dep, which keeps them themable. Use `class-variance-authority` for variant management. `next-themes` (works in Vite via the `useTheme` hook pattern) for the dark/light toggle.

**Tokens** (CSS variables, dark mode root):

```
--bg              #0b0b10        page background, near-black with a faint cool tilt
--bg-elev         #131320        cards, panels
--bg-elev-2       #1a1a2a        popovers, dropdown menus
--border          rgba(255,255,255,0.08)
--text            #e7e7ee
--text-muted      #9a9aa8
--text-subtle     #6e6e7e

--accent          #a78bfa        primary purple (Tailwind violet-400)
--accent-strong   #8b5cf6        hover, focus rings (violet-500)
--accent-soft     rgba(167,139,250,0.12)   subtle fills, selection

--success         #34d399
--warning         #fbbf24
--danger          #f87171

--radius-sm       6px
--radius          8px
--radius-lg       12px

--font-sans       "Inter", system-ui, sans-serif
--font-mono       "JetBrains Mono", ui-monospace, monospace
--text-xs         12px / 16px
--text-sm         13px / 18px      base UI size — readable, not chunky
--text-base       14px / 20px      body copy
--text-lg         16px / 22px      section headers
--text-xl         18px / 24px      page titles

--btn-h-sm        26px
--btn-h           30px              default — deliberately on the smaller side
--btn-h-lg        34px
--btn-padding-x   10px
--input-h         30px
```

Light mode swaps `--bg`, `--bg-elev*`, `--text*`, `--border` and keeps the same accent.

**Component vibe.** Compact rows in tables, single-pixel borders, no heavy shadows. Hover states are subtle background tints (`--accent-soft`), not glow. Focus rings are 2px `--accent-strong` with 2px offset against `--bg`. Motion: 120–180ms easings, never above 220ms. No bounces.

**Type.** Inter at the sizes above. Code, IDs, and JSON previews in JetBrains Mono. Tabular numerals (`font-variant-numeric: tabular-nums`) on every count and timestamp.

**Layout.** Persistent left sidebar (220px), top bar with proxy-account chip and theme toggle, content area max-width 1280px. The sidebar collapses to icons at narrow widths.

### 10.2 Pages

```
/                      Dashboard          totals, recent notifications, proxy account status, alerts
/notifications         Audit log          filter table, click into a row for the full payload + deliveries
/notifications/:id     Detail             payload viewer, per-recipient delivery list, retry buttons
/groups                Groups             list + create + edit (add users/channels)
/groups/:id            Group detail       members, recent activity
/recipients/users      Users              list, add by UPN, resolve to oid via Graph (when consented) or by paste
/recipients/channels   Channels           list, add team_id + channel_id
/templates             Templates          list + create + preview against a sample payload
/templates/:id         Template editor    code editor for body, schema editor, live preview
/rules                 Routing rules      table by source x event pattern x group x template
/sources               Sources            list + create (shows API key once at creation)
/settings              Settings           proxy account sign-in panel, env summary, theme
```

### 10.3 Component inventory (build order)

1. `ThemeProvider`, `ThemeToggle`
2. `AppShell` (sidebar + topbar + content slot)
3. `Button`, `IconButton` — three sizes, four intents (default, primary, ghost, danger). Default size = `--btn-h` (30px).
4. `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `Label`, `FieldRow`
5. `Card`, `Section`, `Divider`
6. `DataTable` (with column sort, pagination, optional row actions)
7. `Badge` (status pills for `sent` / `partial` / `failed` / `unrouted` / `retrying`)
8. `Dialog`, `DropdownMenu`, `Toast`, `Tooltip` (Radix-backed)
9. `JsonViewer` (read-only collapsible tree, monospace)
10. `CodeEditor` (Monaco, only for template body + JSON schema fields)
11. `EmptyState`, `Skeleton`, `Spinner`

All built with the `impeccable` skill principles: subtraction by default, focus on hierarchy, no decorative gradients.

---

## 11. Folder structure (target)

Lives under `notification-engine/` (the project root in deploy).

```
backend/
  src/
    server.js                 -- bootstraps express, wires routes, starts retry worker
    config.js                 -- reads env, exports a frozen config object
    db/
      pool.js                 -- pg pool
      migrate.js              -- node-pg-migrate runner
    middleware/
      apiKey.js               -- X-API-Key auth, hashes on request
      jwt.js                  -- admin Bearer-token verify
      errorHandler.js
      requestId.js
    routes/
      health.routes.js
      notifications.routes.js -- POST /api/notifications (public)
      admin/
        index.js              -- combines admin routers
        auth.routes.js
        proxyAccount.routes.js
        sources.routes.js
        recipients.routes.js
        groups.routes.js
        templates.routes.js
        rules.routes.js
        audit.routes.js
    controllers/               -- thin: validate, call service, return
      notifications.controller.js
      admin/
        sources.controller.js
        groups.controller.js
        ...
    services/                  -- the engine
      notification.service.js  -- the orchestrator
      routing.service.js
      audience.service.js
      template.service.js
      audit.service.js
      retry.worker.js          -- setInterval-based
    integrations/
      msal.service.js          -- token cache, device code flow, getDelegatedToken()
      graph.service.js         -- createClient, createOneOnOneChat, sendChatMessage, sendChannelMessage
    repositories/              -- raw SQL behind clean function names
      sources.repo.js
      recipients.repo.js
      groups.repo.js
      templates.repo.js
      rules.repo.js
      notifications.repo.js
      deliveries.repo.js
      proxyAccount.repo.js
    util/
      ulid.js
      hash.js                  -- api key hashing
      jwt.js                   -- sign/verify admin tokens (HS256)
      mustache.js              -- minimal {{var}} substitution
      eventPattern.js          -- match('kpi.*', 'kpi.degraded') -> true
      logger.js
  migrations/
  .env.example
  package.json

frontend/
  src/
    main.jsx, App.jsx
    styles/
      globals.css              -- tailwind + tokens
    lib/
      api.ts                   -- fetch wrapper, throws on non-2xx
      theme.ts
    components/
      ui/                      -- shadcn-style copy-in components
      AppShell.tsx
      ThemeToggle.tsx
      JsonViewer.tsx
      CodeEditor.tsx
      DataTable.tsx
      StatusBadge.tsx
      ProxyAccountChip.tsx
    pages/
      Dashboard.tsx
      Notifications/
        List.tsx
        Detail.tsx
      Groups/
        List.tsx
        Detail.tsx
      Recipients/
        Users.tsx
        Channels.tsx
      Templates/
        List.tsx
        Editor.tsx
      Rules.tsx
      Sources.tsx
      Settings.tsx
    routes.tsx                 -- react-router v6
  tailwind.config.js
  postcss.config.js
  index.html
  vite.config.js
  package.json

Dockerfile                     -- multi-stage: build frontend, install backend, copy
docker-compose.yaml            -- app + postgres + volume for msal cache
.dockerignore
.env.example
README.md
DESIGN.md                      -- this file
```

`CLAUDE.md` (agent instructions) lives at the repo root one level up — not inside `notification-engine/` — so GitHub Claude Code auto-loads it on every run regardless of cwd.

---

## 12. Docker

Two containers. **One Node process serves both the REST API and the built React frontend** (Express conditionally serves `dist/` in production — see `notification-engine/backend/src/server.js`). No separate web server, no separate frontend container.

```yaml
# notification-engine/docker-compose.yaml
services:
  app:
    image: notification-engine:v1
    container_name: notification-engine
    build: .
    env_file: .env
    ports:
      - "${PORT:-5000}:${PORT:-5000}"      # internal port is set via PORT env var
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - notification-engine-msal:/data/msal   # MSAL token cache survives restarts
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    container_name: notification-engine-db
    environment:
      POSTGRES_USER: notif
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: notif
    volumes:
      - notification-engine-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U notif -d notif"]
      interval: 5s
      timeout: 3s
      retries: 10
    restart: unless-stopped

volumes:
  notification-engine-data:
    name: notification-engine-data        # primary Postgres data volume
  notification-engine-msal:
    name: notification-engine-msal        # MSAL token cache volume
```

**Naming conventions (fixed):**

| Resource | Name |
|---|---|
| App image | `notification-engine:v1` |
| App container | `notification-engine` |
| DB container | `notification-engine-db` |
| Postgres data volume | `notification-engine-data` |
| MSAL cache volume | `notification-engine-msal` |

**Port.** The internal Express port is set by the `PORT` env var (default 5000). docker-compose maps that to the host with identical numbering, so `PORT=8080` in `.env` produces `host:8080 -> container:8080`.

**Dockerfile** is multi-stage: stage 1 builds the frontend (`npm ci && npm run build` in `frontend/`), stage 2 is a slim Node 20 runtime containing only `backend/` source, the frontend `dist/` (copied into the location Express serves from), and production `node_modules` (`npm ci --omit=dev` in `backend/`). The `CMD` is `node src/server.js`.

---

## 13. Configuration (env)

```
# notification-engine/backend/.env.example
NODE_ENV=production
PORT=5000                          # internal app port; docker-compose maps host->container 1:1

# Database
DATABASE_URL=postgres://notif:CHANGE_ME@db:5432/notif
DB_PASSWORD=CHANGE_ME

# MSAL / Entra (proxy account, outbound to Microsoft Graph)
ENTRA_CLIENT_ID=5935a6c7-dea3-4ff2-adf0-fb90e27e2f3c
ENTRA_TENANT_ID=a7853600-5c09-49fd-adca-53fa929e9645
MSAL_CACHE_DIR=/data/msal

# Admin (single account, JWT auth)
ADMIN_USERNAME=admin               # default 'admin' if unset
ADMIN_PASSWORD=admin123            # default 'admin123' if unset — CHANGE BEFORE DEPLOY
JWT_SECRET=                        # required in prod (>=32 random bytes); dev auto-generates with warning

# Limits
DEFAULT_SOURCE_RPM=60
RETRY_MAX_ATTEMPTS=5
RETRY_BASE_DELAY_MS=30000
```

The `CLIENT_ID` and `TENANT_ID` defaults in the working MVP move here. No secrets in code. The admin password is intentionally plaintext in env (constant-time compared at login) — this is an internal tool with one operator; hashing in env adds complexity without a clear threat model.

---

## 14. Open questions

Document, don't block.

- **Admin SSO.** When the org grants admin consent for `User.Read` (delegated) on the engine's Entra app, swap local password auth for Microsoft SSO using the same MSAL machinery. Same Entra app is fine; same cache file is fine if scopes are aligned, otherwise a separate cache file keyed by purpose.
- **Receiver.** When `Chat.Read` consent lands, ship `receiver.js`-style polling as a separate worker process that writes inbound messages into a new `inbound_messages` table. Out of scope here.
- **Channel posting.** Confirm the proxy user is a member of every target team before adding channels in the UI. Add a "test send" button in the channel form that posts a one-line probe and surfaces the Graph error if any.
- **Image attachments at scale.** Body limit is intentionally uncapped (section 4.1). Audit-table growth from large payloads is the cost we pay; a real blob store and payload offloading is deferred unless we see it in practice.
- **Rule precedence.** Current design: every matching rule fires (with cross-rule recipient de-dup). If we later need "match the most specific only", `priority` + a `stop_on_match` boolean on the rule is the cheap path.

---

## 15. Build sequence (the actual coding order)

Each step ends with something you can poke at. Docker and docs intentionally last — they only matter once the app works.

1. **Backend bootstrap.** Add `pg`, `argon2`, `jsonwebtoken`, `node-pg-migrate`, `zod`, `@azure/msal-node`, `@microsoft/microsoft-graph-client`, `ulid` to `notification-engine/backend/package.json` (never the root `app/package.json` — that belongs to the MVP). Write `config.js` (reads env, with the `ADMIN_USERNAME` / `ADMIN_PASSWORD` defaults and the `JWT_SECRET` auto-generate-with-warning fallback). Wire `requestId`, `errorHandler`, JSON body parsing with `limit: '1gb'` into `src/server.js`. Add `/api/health` returning `{ ok: true, db: 'up' | 'down', msal: 'signed_in' | 'signed_out' }`.
2. **Database.** Author migrations for every table in section 7. Run them locally against a Postgres you start by hand (compose comes later). Seed one source, one user, one group, one template, one rule for smoke tests.
3. **MSAL service.** Port `delegated.js` into `integrations/msal.service.js` (cache load/save, `acquireTokenSilent`, device code fallback). Expose `getDelegatedToken()` and `getSignedInAccount()`. Move the hardcoded `SENDER_USER_ID` into `proxy_account` table populated from the token's `oid` claim.
4. **Graph service.** Port `delegated.js` + `delegated-image.js` send paths into `integrations/graph.service.js`: `createOneOnOneChat(targetUser)`, `sendChatMessage(chatId, body, attachments?, hostedContents?)`, `sendChannelMessage(teamId, channelId, ...)`. No business logic here — just Graph calls.
5. **Repositories.** One file per table from section 7. Plain SQL via `pg`, no ORM. Each exports `findById`, `list`, `create`, `update`, `delete` as needed.
6. **Services.** In order: `template.service.js` (render + schema validate), `audience.service.js` (expand group -> dedup recipient list), `routing.service.js` (match `(source, event_type)` -> rule list), `audit.service.js` (write `notifications` and `notification_deliveries`), `notification.service.js` (the orchestrator that ties them together and calls `graph.service`).
7. **Retry worker.** `retry.worker.js` started from `server.js` with `setInterval`. Picks up `retrying` rows, applies backoff, updates parent status.
8. **Public ingestion endpoint.** `POST /api/notifications` with `X-API-Key` middleware. Validates with zod. Returns 202 with the synchronous result so far. End-to-end smoke test: curl in, watch DB rows + Teams message.
9. **Admin auth.** `POST /api/admin/auth/login` accepts `{ username, password }`, constant-time-compares against `ADMIN_USERNAME` / `ADMIN_PASSWORD` env (default `admin` / `admin123`), signs an HS256 JWT with `JWT_SECRET` (7-day TTL), returns `{ token, expires_at }`. Middleware `middleware/jwt.js` protects every `/api/admin/*` route except `/auth/login`. Add `GET /api/admin/auth/me` returning `{ username }` for the frontend to verify a stored token at boot.
10. **Admin proxy-account endpoints.** Surface MSAL state, expose device-code start as a streamed response (SSE) so the UI can show the code and poll until the cache is populated.
11. **Admin CRUD endpoints.** Sources (key shown once), recipients (users + channels), groups (with member add/remove), templates (with `/preview`), rules. Each route stack: controller -> service -> repo.
12. **Admin audit endpoints.** List notifications with filters, fetch one with deliveries, retry endpoints.
13. **Frontend foundation.** Install `tailwindcss`, `class-variance-authority`, `lucide-react`, `react-router-dom`, `@monaco-editor/react`. Wire Tailwind, drop in tokens from section 10.1. Build `ThemeProvider`, `ThemeToggle`, `AppShell`.
14. **Frontend primitives.** `Button`, `Input`, `Select`, `Badge`, `Card`, `DataTable`, `Dialog`, `Toast`, `EmptyState`. Build in `components/ui/`. Verify the dark/light/purple/compact look in a Storybook-free demo page first.
15. **Frontend pages, top-down.** Dashboard -> Notifications list & detail -> Sources -> Recipients -> Groups -> Templates (with Monaco) -> Rules -> Settings (proxy-account panel). Each page is read-write end-to-end before moving to the next.
16. **End-to-end QA.** From an external machine, curl with an admin-created API key against the running engine. Verify: routing, multi-group fan-out, recipient de-dup, image composition, adaptive card, template validation failure, 429 retry, manual retry, audit detail.
17. **Dockerfile + docker-compose.** Multi-stage build, two services, two named volumes. `docker compose up -d`, hit the engine on the host, sign in the proxy account through the UI, run the same QA again.
18. **README + operator docs.** How to deploy, how to add a source, how to add a recipient, how to write a template, how to add a rule, how to read the audit log, how to rotate the proxy account.

---

## 16. What I noticed about how you think

- You said "do we not need a get template route" — that's the right instinct. You correctly figured out that internal callers should use functions, not HTTP self-calls. The design above leans on it: controllers are thin, services do the work.
- "we need two container only one for the app and one for the database" — also right for the load this will see. The doc resists adding Redis or a separate worker container; the retry worker lives in-process until volume justifies splitting.
- "extremely flexible and could receive from any source and any kind of request" — captured by the hybrid routing model. Senders own the `event_type` namespace; admins own the routing in the UI; the engine has zero hardcoded mappings.
- "buttons and looks is in the smaller side so it looks professional" — encoded as concrete pixel values in the token table, not "make it nice".
