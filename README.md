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
    authenticate.js            # verifies the JWT signature, sets req.user from its payload
    requireRole.js             # checks req.user.role — use AFTER authenticate on every route that needs it
    upload.js                  # multer wrapper for file uploads
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
    profile/
      profile.routes.js
      profile.controller.js
      profile.service.js
      profile.model.js          # mongoose schema, singleton document
    people/
      people.routes.js
      people.controller.js
      people.service.js
      people.model.js           # mongoose schema
    youtube/
      youtube.routes.js
      youtube.controller.js
      youtube.service.js
    members/
      member.routes.js
      member.controller.js
      member.service.js
      member.model.js            # mongoose schema
    horoscope/
      horoscope.routes.js
      horoscope.controller.js
      horoscope.service.js
      reading.model.js            # mongoose schema, unique (userKey, date) index
    visitors/
      visitor.routes.js
      visitor.controller.js
      visitor.service.js
      visitor.model.js            # mongoose schema
    gita/
      gita.routes.js
      gita.controller.js
      gita.service.js              # no model — fully stateless, in-memory cache only
    finance/
      transaction.routes.js
      transaction.controller.js
      transaction.service.js
      transaction.model.js          # mongoose schema
  config/
    db.js                    # mongoose connection
    imagekit.js               # ImageKit SDK client
    ytdlp.js                  # resolves the path to the downloaded yt-dlp binary
    googleAuth.js              # verifies Google ID tokens for member sign-in
    openrouter.js               # shared OpenRouter client + model — used by chat AND horoscope
scripts/
  setup-ytdlp.mjs            # downloads yt-dlp's standalone binary into bin/ (runs via postinstall)
bin/                          # yt-dlp binary lands here — gitignored, not committed
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

Routed through [OpenRouter](https://openrouter.ai) (OpenAI-compatible API — set `OPENROUTER_MODEL` to any model ID from openrouter.ai/models; defaults to `nvidia/nemotron-nano-9b-v2:free`. **Do not** set this to the `openrouter/free` alias — it randomly load-balances across every free model on OpenRouter, including reasoning models that silently burn their whole token budget on hidden "thinking" tokens before ever writing a real reply, coding-agent models, and even a content-moderation classifier. All of those produced garbage or empty replies when this was actually tested — pin to one real instruct model instead. The shared client lives in `src/config/openrouter.js`, used by both this module and the Horoscope one below.). Conversation history itself is **not** persisted — the frontend keeps it in memory/localStorage and resends the full message list each turn. The one thing that *is* saved to MongoDB: if the visitor shares both their **name and address** during the chat, the model calls a `save_contact_info` tool and the backend writes it to the `contacts` collection.

- `POST /api/chat` — body `{ messages: [{ role: "user"|"assistant", content: string }, ...] }` (first message must be `role: "user"`, max 40 messages, 4000 chars each)
  → Server-Sent Events stream:
  - `data: {"text": "..."}` — one event per text chunk as the model generates it
  - `event: done` — stream finished successfully
  - `event: error` — something went wrong server-side (details are logged, not leaked to the client)

Requires `OPENROUTER_API_KEY` in the environment (see `.env.example`; get one at [openrouter.ai/keys](https://openrouter.ai/keys)).

## Contacts API

- `GET /api/contacts` → `{ contacts: [{ name, address, email?, phone?, source, createdAt }, ...] }`, newest first
- Requires header `x-api-key: <ADMIN_API_KEY>` — generate a value with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and set it as `ADMIN_API_KEY` in the environment.

## Roles

There are two, completely separate: **admin** (you — one account, see Auth API below) and **member** (self-service visitor accounts, see Members API below). Every JWT this backend issues carries a `role` claim, and every route that shouldn't be publicly readable is guarded by `authenticate` (checks the token is valid) followed by `requireRole('admin')` or `requireRole('member')` (checks the token is the *right kind*). A member token authenticates fine but gets a `403` on any admin route, and vice versa — `authenticate` alone was never enough to guarantee that, which is why every existing admin route (Profile, People, `GET /api/auth/devices`) now has `requireRole('admin')` explicitly added, not just `authenticate`.

## Auth API

Single-admin login (not a multi-user system) — user lives in a MongoDB `users` collection (`username`, `passwordHash`, `role`), not in env vars. `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` only bootstrap the very first admin account on first startup (when the collection is empty) — after that, the DB is the source of truth and those env vars are ignored.

- `POST /api/auth/login` — body `{ username, password }` → `{ token }` (JWT, 7-day expiry) or 401 on bad credentials
- `PATCH /api/auth/password` — requires header `Authorization: Bearer <token>`; body `{ currentPassword, newPassword }` (min 8 chars) → `{ success: true }` or 401 if `currentPassword` is wrong. This is how you change your password going forward — no code/env edits needed.
- `POST /api/auth/device` — requires header `Authorization: Bearer <token>`; body `{ deviceName, os?, browser?, ...anything }` → saves a record with `username`, `deviceName`, `os`, `browser`, server-captured `ip` and `userAgent`, plus any other body fields under `metadata`
- `GET /api/auth/devices` — requires the same bearer token → `{ devices: [...] }`, newest first, scoped to the logged-in username

Requires three env vars (see `.env.example`):
- `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` — bootstrap only, for the first admin account. Generate the hash with `node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"` — never store the plain password anywhere.
- `JWT_SECRET` — signs the tokens; generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Profile API

Your own profile — a single document, not a list. Fully private: both GET and POST require the same bearer token as the Auth API.

- `GET /api/profile` — requires header `Authorization: Bearer <token>` → `{ profile }` (`profile` is `null` if you haven't saved one yet)
- `POST /api/profile` — requires the same header; body `{ name, age?, gender?, height?, weight?, email?, phone?, location?, occupation?, bio?, avatarUrl?, skills?: string[], socialLinks?: object, extra?: any }` → `{ profile }`. Creates the profile on first call, overwrites the same document on every call after (upsert) — there is never more than one.
- `POST /api/profile/avatar` — requires the same header; `multipart/form-data` with a single file field named `avatar` (png/jpeg/webp/gif, max 5MB) → uploads it to ImageKit and saves the resulting URL as the profile's `avatarUrl` → `{ avatarUrl, profile }`.

Only `name` is required; every other field is optional. `extra` is an open object for anything not explicitly listed above.

Avatar uploads require `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT` in the environment — get them from [imagekit.io/dashboard/developer/api-keys](https://imagekit.io/dashboard/developer/api-keys) (a free account is enough). Only the public key and URL endpoint are safe to share; keep the private key as secret as `JWT_SECRET`.

## People API

Friends, family, or anyone else you want a record of — a list, not a singleton. Fully private (unlike the profile fields above, this is other people's personal data, not just yours): both GET and POST require the same bearer token as the Auth API.

- `GET /api/people` — requires header `Authorization: Bearer <token>` → `{ people: [...] }`, newest first
- `POST /api/people` — requires the same header; body `{ name, relation?, age?, phone?, email?, birthday?, howWeMet?, notes?, extra?: any }` → `{ person }` (201)

Only `name` is required. `relation` is a free-text label (e.g. "friend", "family", "colleague"). `extra` is an open object for anything not explicitly listed above.

## YouTube Download API

Requires being signed in — either as admin or as a member — but is deliberately **not** open to unauthenticated visitors (a public, unauthenticated version of this was considered and specifically rejected: anonymous mass access to a YouTube-downloading service is a real ToS/copyright exposure risk for whoever operates it; requiring a real signed-in account, even a self-service one, keeps every use tied to an identifiable person). Paste a YouTube URL, get its available formats, then download one. Uses [yt-dlp](https://github.com/yt-dlp/yt-dlp)'s official standalone binary (downloaded automatically by `npm install` via `scripts/setup-ytdlp.mjs`, no system Python required) driven directly through `child_process`, piping the video straight from yt-dlp's stdout into the HTTP response — nothing is ever written to disk on the server.

- `POST /api/youtube/info` — requires header `Authorization: Bearer <token>` (admin OR member token); body `{ url }` (must be a youtube.com/youtu.be URL) → `{ title, thumbnail, duration, uploader, videoFormats: [{ formatId, ext, resolution, filesizeApprox, note }], audioFormats: [...] }`. Only progressive formats (video+audio already combined) and audio-only formats are listed — no `ffmpeg`-merge step is set up, so the highest resolutions that require merging separate video/audio tracks won't appear.
- `GET /api/youtube/download?url=...&formatId=...&title=...&ext=...` — requires the same header (admin OR member token); streams the file back with `Content-Disposition: attachment`. `title`/`ext` are optional, only used to name the downloaded file (pass the values from the `/info` response).

Only `formatId`s exactly matching `^[a-zA-Z0-9_.+-]+$` are accepted (defense in depth — args are passed to `child_process.spawn` as an array, never through a shell, so there's no injection path regardless, but a real yt-dlp format ID never contains anything else anyway).

- `GET /api/youtube/health` — admin-only → `{ binaryPresent, version, error, jsRuntime, nodeVersion, cookiesConfigured, platform, binaryPath }`. Use this first when downloads fail on the deployed server.

Download errors: nothing (status, `Content-Disposition`) is sent until yt-dlp emits its first byte, so a failure before that is a normal JSON error (`502` with a readable message, e.g. a bot-check or unavailable-format error). A failure mid-stream drops the connection rather than ending it cleanly, so the client sees a failed download instead of a truncated file. Full yt-dlp stderr is always logged server-side.

### Running on a server (Render)

- **Binary:** `scripts/setup-ytdlp.mjs` downloads the self-contained per-platform build (`yt-dlp_linux` / `yt-dlp_macos` / `yt-dlp.exe`), not the plain `yt-dlp` Python zipapp, so no system Python is needed. Every deploy gets the latest release (`bin/` isn't committed); locally, refresh with `npm run setup:ytdlp -- --force`.
- **JS runtime:** yt-dlp needs a JavaScript runtime for YouTube extraction. Every call passes `--js-runtimes node:<path of the running node binary>`, so nothing extra has to be installed.
- **Bot check / cookies:** YouTube blocks most datacenter IPs with "Sign in to confirm you're not a bot". Fix: export `cookies.txt` (Netscape format, e.g. with a "Get cookies.txt" browser extension) from a browser logged into a **throwaway** Google account (YouTube may flag accounts used this way), then either paste its contents into `YTDLP_COOKIES` (literal `\n` is accepted for newlines) or upload it as a Render Secret File and set `YTDLP_COOKIES_FILE=/etc/secrets/<name>`. Either way it's copied to a writable temp file at startup, since yt-dlp writes refreshed cookies back. Cookies expire; re-export when the bot-check error comes back.

## Members API

Self-service accounts for site visitors — a completely separate role from the admin, can only ever read/write their own record (see **Roles** above). Sign-in is **Google-only, no passwords** — decided over password or password+Google specifically to avoid the extra setup burden of a hybrid flow while it wasn't needed yet.

- `POST /api/members/google` — public, no auth. Body `{ idToken }` — the ID token from the frontend's "Sign in with Google" button (Google Identity Services JS library), NOT the same thing as an OAuth authorization code. Verifies it against Google's servers, then finds or creates the member by their Google account ID → `{ token, member }`. `token` is this backend's own JWT (`role: "member"`, 7-day expiry, same secret/convention as admin login) — use it as `Authorization: Bearer <token>` on every call below.
- `GET /api/members/me` — requires header `Authorization: Bearer <member token>` → `{ member }`
- `POST /api/members/me` — requires the same header; body any subset of `{ name?, address?, phone?, interests?: string[], favoriteMovie?, language? }` → `{ member }`. Partial update, always scoped to the calling member's own record (there's no way to pass someone else's ID — it's read from the token, not the body). `email` isn't editable here — it's tied to the Google account.
- `POST /api/members/me/avatar` — requires the same header; `multipart/form-data`, file field `avatar` (png/jpeg/webp/gif, max 5MB) → uploads to ImageKit under `/portfolio/members/avatars` (kept separate from your own `/portfolio/avatars`) → `{ avatarUrl, member }`
- `GET /api/members` — admin-only (`Authorization: Bearer <admin token>`) → `{ members: [...] }`, newest first. Read-only roster so you can see who's signed up.

A member's own `name`, `email`, and `avatarUrl` are populated automatically from their Google account on first sign-in (Google doesn't provide phone/address, so those start empty — collect them via `POST /api/members/me` after sign-in). `googleId` is never included in any API response.

### Setting up Google Sign-In

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials), create an **OAuth 2.0 Client ID** of type **Web application**.
2. Add your frontend's origins under **Authorized JavaScript origins** — `http://localhost:5173` for local dev, plus your deployed frontend URL.
3. Copy the **Client ID** (not the secret — this flow doesn't need one) into `GOOGLE_CLIENT_ID` in `.env`, and the same value into Render's environment variables for production. The frontend needs this exact same Client ID to initialize its "Sign in with Google" button.

## Horoscope API

A fun, entertainment-only feature — every response includes a `disclaimer` field the frontend should always display; this is AI-generated flavor text, not a genuine prediction. Requires being signed in (admin or member — same access model as the YouTube API above, not open to anonymous visitors). Limited to **one reading per user per day**: submit birth details once, get a "this year" and a "today" reading back; submitting again the same day (even with different birth details) just returns the same reading already generated — it does not regenerate. This is enforced with a unique `(userKey, date)` index at the database level, not just app logic, so it holds even under concurrent requests.

- `POST /api/horoscope` — requires header `Authorization: Bearer <token>` (admin OR member); body `{ dob, birthTime?, birthPlace? }` (`dob` required, any parseable date string) → `{ reading, cached, disclaimer }`. `cached: false` + `201` the first time today; `cached: true` + `200` on every subsequent call today.
- `GET /api/horoscope/today` — requires the same header → `{ reading, disclaimer }` (`reading` is `null` if nothing generated yet today) — a way to check without resubmitting birth details.

`reading` shape: `{ dob, birthTime?, birthPlace?, yearReading, dayReading, date, createdAt }`.

Uses the shared OpenRouter client (`src/config/openrouter.js`, same `OPENROUTER_API_KEY`/`OPENROUTER_MODEL` as the Chat API — no separate env vars needed). `max_tokens` is set generously (1200) specifically because the default model does hidden reasoning before the real answer; a tighter budget was tested and reliably truncated before any real content came out.

## Visitors API

Tracks anonymous browsing on the **public** portfolio site — not the admin area, not signed-up members. Every page load calls the public track endpoint; only you can read the collected data back.

- `POST /api/visitors/track` — public, no auth. Body from the frontend: `{ path, referrer?, language?, timezone?, screenWidth?, screenHeight?, preciseLocation?: { latitude, longitude, accuracy }, locationPermission?: "granted"|"denied"|"unavailable"|"not_requested" }` → `201 { success: true }`. `ip` and `userAgent` are always captured server-side from the request itself, never trusted from the body. This endpoint is deliberately built to **never hard-fail a real visitor's page load** — a missing/malformed field (wrong type, oversized string, garbage `preciseLocation`, an invalid `locationPermission` value) gets coerced, truncated (500 chars), or silently dropped rather than rejected; the only 400 is a genuinely missing `path`.
- `GET /api/visitors` — admin-only (`Authorization: Bearer <admin token>`); query params `page` (default 1) and `limit` (default 50, capped at 200) → `{ visitors: [...], total }`, newest first. Paginated from the start since this collection grows on every page view, unlike the other list endpoints in this API.

`ipLocation` (city/region/country/lat/lon) is resolved server-side from the captured IP via [ip-api.com](https://ip-api.com)'s free endpoint — no API key needed, but it's called over plain HTTP (the free tier doesn't offer HTTPS) and is skipped entirely for localhost/private-range IPs (127.x, 10.x, 172.16–31.x, 192.168.x), since those always fail external lookup anyway. A failed or rate-limited lookup just leaves `ipLocation` unset — it never blocks saving the rest of the visit. This is separate from `preciseLocation`, which only gets populated if the frontend explicitly requests and receives browser Geolocation API permission (`locationPermission: "granted"`).

Worth knowing: collecting IP + resolved location + (optionally) precise GPS from every visitor, stored indefinitely and admin-readable, is the kind of data collection that typically warrants a privacy policy disclosure — and in the EU, likely consent for anything beyond bare IP-based analytics. Nothing here builds a consent banner or policy page; that's a product decision for you to make, not something implemented as part of this API.

## Bhagavad Gita API

A separate feature from Horoscope, not a replacement — different shape on purpose. Horoscope is personalized (needs birth data) and AI-generated (so it's gated behind login and cached per-user). This one isn't personalized — same verse for every logged-in user on a given day, sourced from a real verse database rather than AI-generated (fabricating "scripture" text would be a genuine accuracy problem, not just harmless fluff the way a fun horoscope is). No database of our own (no model, no persistence for the verse itself) — everything is either fetched live or held in an in-memory cache. Access-gated the same way as Horoscope/YouTube (any logged-in user, admin or member) rather than fully public, by request — nothing about the content itself required that, it's purely an access-control choice.

- `GET /api/gita/today` — requires header `Authorization: Bearer <token>` (admin OR member) → `{ verse: { chapter, verse, sanskrit, transliteration, translations: [{ author, text }, ...] } }`

Verse selection is deterministic: `day-of-year % 701` (the Gita's total verse count, fetched once from the source and cached for the life of the process) picks the same chapter/verse for everyone on a given UTC calendar date — no coin-flip randomness, no state to persist, and it naturally cycles through the whole text roughly twice a year. The resolved verse is then cached in memory per day, so the free external API ([vedicscriptures.github.io](https://vedicscriptures.github.io)) only gets hit once daily regardless of visitor traffic, not once per page load.

Free, no API key. Translations come from named traditional scholars (Swami Sivananda, Shri Purohit Swami) as provided by the source — attribution is kept intentionally rather than stripped.

## Finance API

Admin-only expense/income tracker — same auth as Profile/People (`Authorization: Bearer <admin token>`, `401` without it, `403` with a member token).

- `GET /api/finance/transactions?month=YYYY-MM` — `month` is optional; when given, filters to that calendar month → `{ transactions: [...] }`, newest `date` first (ties broken by `createdAt` descending).
- `POST /api/finance/transactions` — body `{ type: "income"|"expense", amount: number > 0, date: "YYYY-MM-DD", category?, note? }` → `{ transaction }` (201)
- `PUT /api/finance/transactions/:id` — body is the same required shape as POST (`type`/`amount`/`date` all required — a full replace, not a partial patch) → `{ transaction }`, or `404` if the ID doesn't exist
- `DELETE /api/finance/transactions/:id` → `{ success: true }`, or `404` if already deleted/never existed

`date` is stored as a plain `"YYYY-MM-DD"` string rather than a `Date` — the month filter matches against it with a string prefix (`^YYYY-MM`), which is simpler and avoids timezone-boundary bugs that a real `Date` field would introduce for "which month does this fall in" queries.

## Vision API (AI Image Studio)

Public, no auth — protected by a per-IP rate limit instead (10 requests / 15 minutes, `src/middleware/rateLimit.js`). Uses the shared OpenRouter client with `OPENROUTER_VISION_MODEL` — a comma-separated list of models that accept image input; the first is primary and the rest are passed as OpenRouter `models` fallbacks, since free vision pools are frequently rate-limited upstream (defaults to `google/gemma-4-31b-it:free,nvidia/nemotron-3.5-super-vl:free,google/gemma-4-26b-a4b-it:free`). Images are processed in memory only — never written to disk, ImageKit, or MongoDB. PNG/JPEG/GIF are downscaled to max 1024px and re-encoded as JPEG (transparency flattened onto white, GIF → first frame) before being sent to the model; WebP is passed through as-is because Jimp can't decode it.

- `POST /api/vision/stream` — `multipart/form-data` with fields `image` (png/jpeg/webp/gif, max 5MB) and `mode` (`describe` | `alttext` | `roast` | `story` | `poem` | `ocr`)
  → Server-Sent Events stream, same format as Chat: `data: {"text": "..."}` chunks, then `event: done` or `event: error` (its `error` is `"busy"` when every model is rate-limited upstream — temporary, retry later — otherwise `"stream failed"`)
  - `400` `{ error }` — missing image, bad file type/size, unreadable image, or invalid `mode`
  - `429` `{ error }` — rate limit hit (`RateLimit` / `RateLimit-Policy` headers say when it resets)

## Database

Uses MongoDB Atlas via `mongoose`. Requires `MONGODB_URI` in the environment — copy the connection string from `db.rd` (untracked, `.gitignore`d) into your `.env`, filling in the real password, and set the same var in Render's dashboard for deployment. The server refuses to start if `MONGODB_URI` is missing.

## Running

```
npm install
npm run dev   # auto-restart on change
npm start
```

Copy `.env.example` to `.env` and fill in every variable listed there.
