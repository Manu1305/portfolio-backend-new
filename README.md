# Backend

Single Express backend that hosts multiple small apps/APIs, each isolated as its own module.

## Structure

```
src/
  app.js                  # express app setup (middleware, route mounting)
  server.js                # entrypoint, starts the http listener
  middleware/
    notFound.js
    errorHandler.js
  routes/
    index.js               # mounts every module's router under /api/<module>
  modules/
    qrcode/
      qrcode.routes.js      # express Router, defines endpoints
      qrcode.controller.js  # request/response handling, validation glue
      qrcode.service.js     # business logic, reusable, no req/res
    chat/
      chat.routes.js
      chat.controller.js
      chat.service.js
    contacts/
      contact.routes.js
      contact.controller.js
      contact.service.js
      contact.model.js        # mongoose schema
    auth/
      auth.routes.js
      auth.controller.js
      auth.service.js
      user.model.js             # mongoose schema
      device.model.js           # mongoose schema
      seedAdmin.js               # creates the first admin user on startup
  config/
    db.js                    # mongoose connection
```

## Adding a new app

1. Create `src/modules/<name>/` with the same three files: `<name>.routes.js`, `<name>.controller.js`, `<name>.service.js`.
2. Register it in `src/routes/index.js`:
   ```js
   import myAppRoutes from '../modules/<name>/<name>.routes.js';
   router.use('/<name>', myAppRoutes);
   ```
3. It's now live under `/api/<name>/...`.

## QR Code API

- `POST /api/qrcode` — body `{ text, format?: "png"|"svg", size?, margin?, darkColor?, lightColor? }` → `{ dataUrl }` (png) or `{ svg }`
- `GET /api/qrcode/download?text=...&format=png|svg` — downloads the file directly

## Chat API

Routed through [OpenRouter](https://openrouter.ai) (OpenAI-compatible API — set `OPENROUTER_MODEL` to any model ID from openrouter.ai/models, defaults to `openrouter/free`). Conversation history itself is **not** persisted — the frontend keeps it in memory/localStorage and resends the full message list each turn. The one thing that *is* saved to MongoDB: if the visitor shares both their **name and address** during the chat, the model calls a `save_contact_info` tool and the backend writes it to the `contacts` collection.

- `POST /api/chat` — body `{ messages: [{ role: "user"|"assistant", content: string }, ...] }` (first message must be `role: "user"`, max 40 messages, 4000 chars each)
  → Server-Sent Events stream:
  - `data: {"text": "..."}` — one event per text chunk as the model generates it
  - `event: done` — stream finished successfully
  - `event: error` — something went wrong server-side (details are logged, not leaked to the client)

Requires `OPENROUTER_API_KEY` in the environment (see `.env.example`; get one at [openrouter.ai/keys](https://openrouter.ai/keys)).

## Contacts API

- `GET /api/contacts` → `{ contacts: [{ name, address, email?, phone?, source, createdAt }, ...] }`, newest first
- Requires header `x-api-key: <ADMIN_API_KEY>` — generate a value with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and set it as `ADMIN_API_KEY` in the environment.

## Auth API

Single-admin login (not a multi-user system) — user lives in a MongoDB `users` collection (`username`, `passwordHash`, `role`), not in env vars. `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` only bootstrap the very first admin account on first startup (when the collection is empty) — after that, the DB is the source of truth and those env vars are ignored.

- `POST /api/auth/login` — body `{ username, password }` → `{ token }` (JWT, 7-day expiry) or 401 on bad credentials
- `PATCH /api/auth/password` — requires header `Authorization: Bearer <token>`; body `{ currentPassword, newPassword }` (min 8 chars) → `{ success: true }` or 401 if `currentPassword` is wrong. This is how you change your password going forward — no code/env edits needed.
- `POST /api/auth/device` — requires header `Authorization: Bearer <token>`; body `{ deviceName, os?, browser?, ...anything }` → saves a record with `username`, `deviceName`, `os`, `browser`, server-captured `ip` and `userAgent`, plus any other body fields under `metadata`
- `GET /api/auth/devices` — requires the same bearer token → `{ devices: [...] }`, newest first, scoped to the logged-in username

Requires three env vars (see `.env.example`):
- `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` — bootstrap only, for the first admin account. Generate the hash with `node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"` — never store the plain password anywhere.
- `JWT_SECRET` — signs the tokens; generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Database

Uses MongoDB Atlas via `mongoose`. Requires `MONGODB_URI` in the environment — copy the connection string from `db.rd` (untracked, `.gitignore`d) into your `.env`, filling in the real password, and set the same var in Render's dashboard for deployment. The server refuses to start if `MONGODB_URI` is missing.

## Running

```
npm install
npm run dev   # auto-restart on change
npm start
```

Copy `.env.example` to `.env` and fill in every variable listed there.
