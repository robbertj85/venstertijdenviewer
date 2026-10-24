# Deploy: prototype.transportlab.app/venstertijdenviewer

Coolify "Docker Compose" resource on the Hetzner VPS (`ssh hetzner`), built
from `docker-compose.yaml` in the repo root. One service, `app` (Next.js
standalone, `deploy/Dockerfile`). The data in `public/data/` is static and
baked into the image; there is no worker, volume or nginx.

- Coolify → Advanced: Consistent Container Names on, Custom Internal Name
  `venstertijdenviewer` → container `app-venstertijdenviewer`.
- Env vars (build args): `NEXT_PUBLIC_UMAMI_SRC`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID`.
- Nginx Proxy Manager, proxy host `prototype.transportlab.app`: custom location
  `/venstertijdenviewer` → `http` `venstertijdenviewer` `3000` (no rewrite).
  The app serves both `/venstertijdenviewer` and `/venstertijdenviewer/`
  (`skipTrailingSlashRedirect`), so NPM's slash redirect doesn't loop.
- After a redeploy NPM may 502 (it caches the old container IP):
  `deploy/reload-proxy.sh`.

## Data verversen

`node scripts/fetch-static.mjs` writes `public/data/v4.json` and `v5.json`
from the NDW API. Commit and push; Coolify rebuilds. The "live" button in the
app fetches the NDW API directly through `/api/v1/signs`.

## Local test

    docker network create coolify
    docker compose -p vtvtest -f docker-compose.yaml -f <override publishing 8088:3000> up -d --build
    curl -I http://127.0.0.1:8088/venstertijdenviewer
    docker compose -p vtvtest down && docker network rm coolify
