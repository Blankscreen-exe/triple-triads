# Deployment

Triple Triad is a single Node.js process that serves the web app, the real-time game channel
(Socket.IO over WebSockets) and a health check on **one port**. Everything it stores lives in one
data directory: the SQLite database and, with the default storage, uploaded files.

Pick one way to run it:

| Option                                              | Good for                                    |
| --------------------------------------------------- | ------------------------------------------- |
| [On your own computer](#on-your-own-computer)       | Playing with friends from your PC.          |
| [Docker Compose on a VPS](#docker-compose-on-a-vps) | An always-on server.                        |
| [Docker without Compose](#docker-without-compose)   | Your own orchestration (e.g. a NAS, Nomad). |

Then make it reachable: [Internet access](#internet-access).

> **The first account to sign up becomes the admin.** Sign up straight after the first start.

## On your own computer

Requirements: Node.js 24+, and pnpm via `corepack enable`.

```bash
pnpm install
pnpm build
pnpm start            # http://127.0.0.1:3000
```

Settings go in `apps/web/.env` (copy [`apps/web/.env.example`](../apps/web/.env.example)). Data
is stored in `apps/web/data/` unless `DATA_DIR` says otherwise. The server listens on
`127.0.0.1` only, which is what a tunnel needs; nobody else on your network can reach it directly.

## Docker Compose on a VPS

Requirements: Docker Engine with the Compose plugin (v2.24+).

```bash
git clone <this repository> triple-triad && cd triple-triad
cp .env.example .env    # optional: adjust settings
docker compose up -d --build
docker compose ps       # "healthy" after a few seconds
```

The app is published on `127.0.0.1:3000` of the server (set `APP_PORT` to change it), so it is
not exposed until you put a tunnel or reverse proxy in front: see [Internet access](#internet-access).

Data is kept in the `data` Docker volume and survives rebuilds and restarts. The container runs
as an unprivileged user, restarts automatically, and reports its health from `GET /healthz`.

Useful commands:

```bash
docker compose logs -f app       # JSON logs (one line per request and game event)
docker compose restart app
docker compose down              # stop (data is kept; add -v to delete it, irreversibly)
```

### Updating

```bash
git pull
docker compose up -d --build
```

Database migrations run automatically at startup. [Back up](#backups) before updating.

## Docker without Compose

```bash
docker build -t triple-triad .
docker run -d --name triple-triad --restart unless-stopped \
  -p 127.0.0.1:3000:3000 -v triple-triad-data:/data triple-triad
```

The image listens on `0.0.0.0:3000` inside the container and stores data in `/data`. Pass
settings with `-e NAME=value` or `--env-file`.

### Building behind a TLS-inspecting proxy or antivirus

If the build fails to download packages with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` or
`unable to verify the first certificate`, something between you and the internet (a corporate
proxy, or antivirus "HTTPS scanning") re-signs HTTPS traffic. Give the build its root certificate
as a secret; it is used only while downloading and is not stored in the image:

```bash
docker build --secret id=extra_ca,src=/path/to/root-ca.pem -t triple-triad:latest .
docker compose up -d     # uses the image you just built (no --build)
```

## Internet access

Players need HTTPS and WebSockets to reach the app. Both options below handle both.

### Cloudflare Tunnel (no open ports)

Point the tunnel at `http://localhost:3000` (or `http://app:3000` if `cloudflared` runs in the same
Compose project). WebSockets work through Cloudflare tunnels without extra settings. For a quick
test without an account:

```bash
cloudflared tunnel --url http://localhost:3000
```

### Reverse proxy with automatic HTTPS (Caddy)

On a VPS with a domain pointing at it, [Caddy](https://caddyserver.com) obtains certificates
automatically and proxies WebSockets by default. `/etc/caddy/Caddyfile`:

```caddyfile
play.example.com {
	reverse_proxy 127.0.0.1:3000
}
```

nginx works too; forward the `Upgrade` and `Connection` headers for `/socket.io/`.

### Plain HTTP on a home network

Session cookies are HTTPS-only in production, so logging in over `http://192.168.x.x:3000` fails
by default. For a trusted network only, set `SECURE_COOKIES=false`, and publish the port on the
network (`HOST=0.0.0.0` without Docker; `ports: ['3000:3000']` with Compose).

## Storage

Uploads (card art and players' card styles) go to one of:

- **`local`** (default): `DATA_DIR/uploads`, i.e. inside the `data` volume. Nothing to set up.
- **`minio`**: an S3-compatible bucket, created on first use. Use this to keep files off the app
  server or share them between hosts.

To run MinIO next to the app with Compose, set these in `.env`:

```bash
STORAGE_DRIVER=minio
MINIO_ENDPOINT=minio
MINIO_ACCESS_KEY=triple-triad
MINIO_SECRET_KEY=<a long random secret>
```

and start with the `minio` profile:

```bash
docker compose --profile minio up -d --build
```

MinIO stopped publishing community Docker images in 2025, so the Compose file uses the last
Bitnami build, which no longer receives updates. It is not exposed outside the Compose network.
For a long-lived installation, prefer a maintained S3-compatible server or a hosted bucket and set
`MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL` and `MINIO_BUCKET` to match.

Switching drivers does not move existing files; switch before players upload anything, or copy
the files across (keys are the same paths in both).

## Backups

Everything is in the data volume (plus the MinIO bucket if you use one). To take a consistent
copy of the database while the game is running:

```bash
docker compose exec app node -e "require('better-sqlite3')('/data/triple-triad.db', { readonly: true }).backup('/data/backup.db').then(() => console.log('Backup written'))"
docker compose cp app:/data/backup.db ./triple-triad-$(date +%F).db
docker compose cp app:/data/uploads ./uploads-$(date +%F)    # local storage only
```

To restore, stop the app, put the database back as `/data/triple-triad.db` (removing any
`triple-triad.db-wal` and `-shm` files next to it), and start the app again.

## Settings

All settings are environment variables, checked at startup: a wrong value stops the server with a
message naming it.

| Variable           | Default                          | Description                                                                  |
| ------------------ | -------------------------------- | ---------------------------------------------------------------------------- |
| `HOST`             | `127.0.0.1` (`0.0.0.0` in image) | Interface to listen on.                                                      |
| `PORT`             | `3000`                           | HTTP and WebSocket port.                                                     |
| `DATA_DIR`         | `./data` (`/data` in image)      | Database and local uploads.                                                  |
| `LOG_LEVEL`        | `info`                           | `fatal` `error` `warn` `info` `debug` `trace` `silent`                       |
| `NODE_ENV`         | `development` (`production`)     | Set by `pnpm start` and the image.                                           |
| `SECURE_COOKIES`   | `true` in production             | HTTPS-only session cookies. See [plain HTTP](#plain-http-on-a-home-network). |
| `STORAGE_DRIVER`   | `local`                          | `local` or `minio`.                                                          |
| `MINIO_ENDPOINT`   |                                  | Host name of the S3-compatible server (required for `minio`).                |
| `MINIO_PORT`       | `9000`                           |                                                                              |
| `MINIO_USE_SSL`    | `false`                          | `true` for HTTPS endpoints.                                                  |
| `MINIO_ACCESS_KEY` |                                  | Required for `minio`.                                                        |
| `MINIO_SECRET_KEY` |                                  | Required for `minio`.                                                        |
| `MINIO_BUCKET`     | `triple-triad`                   | Created if missing.                                                          |
| `APP_PORT`         | `3000`                           | Compose only: port published on the host.                                    |

Game rules (card scores, deck limits, room options) are not environment settings: admins change
them in the admin panel, and they apply immediately.

## Security notes

- Passwords are hashed with Argon2id; sessions are random tokens stored only as SHA-256 hashes.
- Failed logins are throttled per username, so this works the same behind a proxy or tunnel.
- Uploaded images are decoded and re-encoded before storage (stripping metadata and anything
  that is not image data) and fonts are checked by file signature; files are served with fixed
  content types and `X-Content-Type-Options: nosniff`.
- Keep the data volume private: it holds the database with password hashes.
