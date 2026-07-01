# Render Deployment

Kamiya deploys as a single Render Node web service. The Express server serves both:

- `GET /api/*` API routes
- The built Vite frontend from `dist/`

## Blueprint

The root `render.yaml` defines:

- Service type: `web`
- Runtime: `node`
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check: `/api/health`

## Environment Variables

Use `.env.render.example` as the Render Dashboard guide.

Required secrets/config:

- `KAMIYA_GEMINI_API_KEY`: secret Gemini API key.
- `KAMIYA_CERBANIMO_API_URL`: Cerbanimo API base URL.
- `KAMIYA_CERBANIMO_BEARER_TOKEN`: scoped Cerbanimo service/bot token, or a short-lived backend-issued JWT until service tokens exist.
- `KAMIYA_ALLOWED_ORIGIN`: Kamiya's public Render URL after first deploy.

Render injects `PORT` automatically. Do not commit real `.env` files.

## Deploy Steps

1. Push this repository to GitHub as a private repository.
2. Open Render Dashboard.
3. Create a new Blueprint from the GitHub repo.
4. Confirm `render.yaml` is detected.
5. Fill all `sync: false` variables.
6. Apply the Blueprint.
7. After Render assigns a URL, set `KAMIYA_ALLOWED_ORIGIN` to that URL and redeploy.

Blueprint deeplink format after the GitHub repo exists:

```text
https://dashboard.render.com/blueprint/new?repo=https://github.com/<owner>/<repo>
```
