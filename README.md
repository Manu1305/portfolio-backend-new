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

## Running

```
npm install
npm run dev   # auto-restart on change
npm start
```

Copy `.env.example` to `.env` to configure `PORT` and `CORS_ORIGIN`.
