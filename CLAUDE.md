# CLAUDE.md — Notification Engine

You are working on the **Notification Engine**: an internal service that receives platform events over HTTP and sends Teams notifications through Microsoft Graph using a delegated proxy user. The full architecture and build sequence is in [notification-engine/DESIGN.md](notification-engine/DESIGN.md). **Read DESIGN.md before touching code.**

The owner is Mohamed Ali. Do not list yourself as a collaborator or co-author on commits.

---

## Where the code lives — read this before any edit

The real app is the **`notification-engine/`** folder. Every edit, new file, dependency, migration, and Docker change for the engine happens inside that folder. The repo root holds the working MVP reference files and shared tooling.

```
notifications-bot/  (this repo root, also your cwd)
  .claude/                                <- vendored skills (superpowers, impeccable)
    settings.json
    skills/
      using-superpowers/
      brainstorming/
      writing-plans/
      test-driven-development/
      systematic-debugging/
      verification-before-completion/
      impeccable/
      ...
  delegated.js                            <- READ-ONLY REFERENCE: working MVP, text + adaptive card send
  delegated-image.js                      <- READ-ONLY REFERENCE: working MVP, image send via hostedContents
  server.js                               <- DEAD: failed app-only experiment, ignore
  receiver.js                             <- OUT OF SCOPE: blocked on Chat.Read tenant consent
  ai_chat.md                              <- historical context, how the MVP evolved
  Numbers.png                             <- sample image used by delegated-image.js
  package.json                            <- MVP deps only; do NOT add the engine's deps here
  .msal-cache.json                        <- MVP's token cache; engine has its own at runtime
  CLAUDE.md                               <- this file
  notification-engine/                    <- THE REAL APP. all engine work happens here.
    backend/
      package.json                          <- add engine backend deps here
      src/
        server.js                            engine entrypoint (Express 5, ESM)
    frontend/
      package.json                          <- add engine frontend deps here
      src/
    Dockerfile
    docker-compose.yaml
    README.md
    DESIGN.md                              <- the full architecture spec
```

When DESIGN.md or this file says `backend/`, `frontend/`, `Dockerfile`, `docker-compose.yaml`, or `package.json` in the context of the engine, it always means **inside `notification-engine/`**, never the root versions. The root `package.json`, `delegated.js`, `delegated-image.js`, `server.js`, `receiver.js`, and `ai_chat.md` are read-only reference — do not edit them.

---

## Skills you should use

The repo ships with the **superpowers** and **impeccable** skill packs vendored at [.claude/skills/](.claude/skills/). The rules in [.claude/skills/using-superpowers/SKILL.md](.claude/skills/using-superpowers/SKILL.md) apply: **if there's even a 1% chance a skill applies, invoke it.** When in doubt, invoke.

- **[.claude/skills/brainstorming/](.claude/skills/brainstorming/)** before adding any feature not already in DESIGN.md. Don't expand scope silently.
- **[.claude/skills/writing-plans/](.claude/skills/writing-plans/)** when given a multi-step task. Produce a plan file before touching code.
- **[.claude/skills/test-driven-development/](.claude/skills/test-driven-development/)** for the routing service, the template renderer, the event-pattern matcher, and the retry worker — they are pure functions or have testable boundaries.
- **[.claude/skills/systematic-debugging/](.claude/skills/systematic-debugging/)** when something breaks. Find the root cause; don't paper over symptoms.
- **[.claude/skills/verification-before-completion/](.claude/skills/verification-before-completion/)** before claiming any task is done. Run the thing, look at the output.
- **[.claude/skills/impeccable/](.claude/skills/impeccable/)** for every frontend change. The design tokens in DESIGN.md section 10.1 are the source of truth; if a component drifts from them, the component is wrong.

---

## What this project is

- Single HTTP endpoint `POST /api/notifications` accepts events from any internal system.
- Routing is data-driven: each request authenticates with an API key (identifies the source) and carries an `event_type`. The engine matches `(source, event_type)` against admin-configured rules to decide which group(s) get the message.
- A group is a named bundle of Teams users and Teams channels.
- Messages can be HTML text, an image, an adaptive card, or any combination.
- Every received request and every per-recipient send is persisted in Postgres for audit and retry.
- Operators use a React admin UI to manage proxy-account sign-in, sources, recipients, groups, templates, routing rules, and the audit log.
- Two containers only: `app` (Node + Express + the React build) and `db` (Postgres).

---

## Stack

- **Backend.** Node 20, Express 5 (ES modules, already configured). `pg` for Postgres, `node-pg-migrate` for migrations, `argon2` for API-key hashing, `jsonwebtoken` for admin auth (single admin from env, JWT in `Authorization: Bearer` header — no cookies, no CSRF surface), `zod` for request validation. `@azure/msal-node` and `@microsoft/microsoft-graph-client` for Teams.
- **Frontend.** React 19 + Vite (scaffolded). Add TypeScript incrementally. Tailwind CSS for styling. shadcn-style components (copied into `notification-engine/frontend/src/components/ui/`, not installed as a dependency). Monaco for the template editor.
- **Deploy.** Multi-stage Dockerfile, docker-compose with the two services above plus two named volumes (`pg_data`, `msal_cache`).

Do not introduce ORMs, GraphQL, tRPC, Redis, or BullMQ unless DESIGN.md changes first. Plain SQL repositories, plain REST.

---

## Working MVP — your reference code

Three files at the repo root demonstrate the working Microsoft Graph send paths. They are not part of the engine, but the engine must reproduce their behavior inside `notification-engine/backend/src/integrations/msal.service.js` and `graph.service.js`.

- [delegated.js](delegated.js) — token cache load/save, `acquireTokenSilent` with device-code fallback, one-on-one chat creation, HTML message send, and an adaptive-card send (`sendMessageToChatWithAdaptiveCard`). Both `SENDER_USER_ID` (the proxy account's Entra object id) and the target UPN are configured up top.
- [delegated-image.js](delegated-image.js) — same flow plus `hostedContents` for image attachments. The HTML body references the image via `<img src="../hostedContents/1/$value" />`.
- [ai_chat.md](ai_chat.md) — historical context: why we chose delegated over app-only, the errors we hit and what they meant, how the MVP evolved.

Both JS files are working today against the current Entra app: `CLIENT_ID=5935a6c7-dea3-4ff2-adf0-fb90e27e2f3c`, `TENANT_ID=a7853600-5c09-49fd-adca-53fa929e9645`. Delegated scopes granted: `Chat.Create`, `ChatMessage.Send`. The proxy account is `biadmin@sd.zain.com` (Entra oid `b2fe3440-be1b-49c5-a6b2-ac527efeca71`); on first run, MSAL prints a verification URL and a device code, you sign in once, and the token cache (`.msal-cache.json`) is reused for subsequent runs.

**Ignore [server.js](server.js).** It is the failed app-only (client credentials) experiment — blocked by the tenant requiring `Teamwork.Migrate.All` for app-only chat sends. The engine uses delegated only.

**[receiver.js](receiver.js)** is also out of scope until the tenant grants admin consent for `Chat.Read`. Do not wire it into the engine.

---

## Coding conventions

- **Thin controllers, real services.** Controllers validate the request and call a service function. They never call another route, never use axios/fetch to talk to themselves, and contain no business logic. The orchestrator is `notification-engine/backend/src/services/notification.service.js`. See section 3 of DESIGN.md.
- **One service per concern.** `routing.service.js` resolves rules. `audience.service.js` expands groups into recipient lists with cross-rule de-duplication. `template.service.js` renders. `graph.service.js` calls Microsoft. Do not mix these.
- **Repositories own SQL.** No raw queries in services. Each repository exports plain async functions (`findById`, `list`, `create`, ...). No query builders; plain parameterized SQL.
- **ULIDs for ids.** All primary keys are ULIDs as text with a per-table prefix (`ntf_`, `src_`, `grp_`, `tpl_`, `rul_`, etc.).
- **No secrets in code.** `CLIENT_ID`, `TENANT_ID`, database URL, admin password hash, session secret — all from env. The hardcoded values in the MVP files are placeholders; the engine reads them from `process.env` only.
- **Errors are typed at the boundary.** Throw `HttpError(status, code, message)` in services; the central `errorHandler` middleware maps them to JSON responses. Do not `res.status(...).json(...)` from a service.
- **No comments that restate code.** Only comment a *why* a reader would not derive from the code: a Graph quirk, a workaround for a tenant policy, an invariant the type system can't express.
- **No emojis in code or commits.**

---

## Design preferences (frontend)

This is binding. The look is part of the product.

- **Dark mode is the default.** Light mode is available via toggle.
- **Purple accent.** Tailwind violet-400 for the resting accent, violet-500 for hover and focus rings. No other chromatic accent; status colors only for status (success / warning / danger).
- **Compact, professional controls.** Default button height 30px, small variant 26px, large variant 34px. Inputs 30px. Tables use compact row heights with single-pixel borders, no chunky shadows.
- **Type.** Inter for UI, JetBrains Mono for IDs, code, JSON. Base UI size 13px / 18px line-height. Body 14px. Section headers 16px. Page titles 18px. Tabular numerals on every number and timestamp.
- **Motion is restrained.** 120–180ms transitions, never above 220ms. No bounce, no glow, no gradients on interactive surfaces.
- **Subtraction first.** Every element earns its pixels. Hover states are subtle background tints (`--accent-soft`), not effects.

Full token table is in section 10.1 of [notification-engine/DESIGN.md](notification-engine/DESIGN.md). Implement those literal values, not vibes.

---

## What not to do

- Do not edit the root-level reference files: `delegated.js`, `delegated-image.js`, `server.js`, `receiver.js`, `ai_chat.md`, `package.json`. They are read-only. All engine work happens inside `notification-engine/`.
- Do not add the engine's npm dependencies to the root `package.json`. Backend deps go in `notification-engine/backend/package.json`; frontend deps go in `notification-engine/frontend/package.json`.
- Do not touch [server.js](server.js). It's a failed app-only experiment kept for historical reference.
- Do not wire [receiver.js](receiver.js) into the engine. Blocked on tenant consent.
- Do not add a separate worker container, Redis, or a queue library. The retry worker runs in-process; see section 9 of DESIGN.md.
- Do not introduce a microservice split. Two containers, app + db. The owner has been explicit about this.
- Do not hardcode the sender Entra oid in production code. Read it from the `proxy_account` row populated from the signed-in token's `oid` claim.
- Do not commit secrets. `CLIENT_ID` and `TENANT_ID` are not secrets and may have defaults in `.env.example`; the admin password hash and session secret have no defaults.
- Do not "fix" things you weren't asked to fix. If you notice something off, say so; don't silently rewrite it.
- Do not add yourself as a co-author or collaborator on commits. The owner is the only collaborator on their repos.

---

## How to start a task

1. Read [notification-engine/DESIGN.md](notification-engine/DESIGN.md) fully. The build order is in section 15 — pick the next unfinished step unless the user has named a different one.
2. If the request is ambiguous, stop and ask. Better one focused question than a wrong implementation.
3. If the request implies a change to DESIGN.md (new endpoint shape, new table, new dependency), update DESIGN.md in the same change. The doc is the contract.
4. Verify with the actual app before declaring done — boot the backend, hit the endpoint, watch the database, look at the UI in the browser.
