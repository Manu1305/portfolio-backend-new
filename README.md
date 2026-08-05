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
  config/
    db.js                    # mongoose connection
    imagekit.js               # ImageKit SDK client
    ytdlp.js                  # resolves the path to the downloaded yt-dlp binary
    googleAuth.js              # verifies Google ID tokens for member sign-in
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

Private, admin-only — not exposed to public visitors. Paste a YouTube URL, get its available formats, then download one. Uses [yt-dlp](https://github.com/yt-dlp/yt-dlp)'s official standalone binary (downloaded automatically by `npm install` via `scripts/setup-ytdlp.mjs`, no system Python required) driven directly through `child_process`, piping the video straight from yt-dlp's stdout into the HTTP response — nothing is ever written to disk on the server.

- `POST /api/youtube/info` — requires header `Authorization: Bearer <token>`; body `{ url }` (must be a youtube.com/youtu.be URL) → `{ title, thumbnail, duration, uploader, videoFormats: [{ formatId, ext, resolution, filesizeApprox, note }], audioFormats: [...] }`. Only progressive formats (video+audio already combined) and audio-only formats are listed — no `ffmpeg`-merge step is set up, so the highest resolutions that require merging separate video/audio tracks won't appear.
- `GET /api/youtube/download?url=...&formatId=...&title=...&ext=...` — requires the same header; streams the file back with `Content-Disposition: attachment`. `title`/`ext` are optional, only used to name the downloaded file (pass the values from the `/info` response).

Only `formatId`s exactly matching `^[a-zA-Z0-9_.+-]+$` are accepted (defense in depth — args are passed to `child_process.spawn` as an array, never through a shell, so there's no injection path regardless, but a real yt-dlp format ID never contains anything else anyway).

This is a personal-use tool, deliberately not public — see the conversation history for why a public, unauthenticated version of this specific feature was intentionally not built (ToS/copyright exposure for a public downloader service).

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

## Database

Uses MongoDB Atlas via `mongoose`. Requires `MONGODB_URI` in the environment — copy the connection string from `db.rd` (untracked, `.gitignore`d) into your `.env`, filling in the real password, and set the same var in Render's dashboard for deployment. The server refuses to start if `MONGODB_URI` is missing.

## Running

```
npm install
npm run dev   # auto-restart on change
npm start
```

Copy `.env.example` to `.env` and fill in every variable listed there.
