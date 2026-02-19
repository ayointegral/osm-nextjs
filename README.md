# Offline OpenStreetMap Viewer

A fully air-gapped OpenStreetMap viewer built with Next.js, Leaflet, and Docker. Designed for environments with no internet access at runtime.

## Architecture

```
[Browser] → [nginx :80] → [Next.js :3000] → [PostgreSQL :5432]
                ↓
         [tiles/ on disk]
```

- **nginx** serves map tiles directly from disk (`/osm/{z}/{x}/{y}.png`)
- **Next.js** handles the UI, settings API, and tile fallback
- **PostgreSQL** stores user settings (zoom, center, provider)
- **Docker network** uses `internal: true` — containers cannot reach the internet

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js >= 22 (for local development only)

### 1. Clone and start

```bash
git clone https://github.com/ayointegral/osm-nextjs.git
cd osm-nextjs
docker compose up -d
```

The app starts at **http://localhost** (port 80). On first run, the map shows placeholder tiles (light gray) because no tiles have been downloaded yet.

### 2. Download UK tiles (optional, requires internet)

Run this on an internet-connected machine **before** deploying to an air-gapped environment:

```bash
# See how many tiles and how long it will take
npm run tiles:download-uk:dry-run

# Download UK tiles at zoom 0-14 (~563K tiles, ~9.4GB, ~20 hours)
npm run tiles:download-uk

# Include z15-z16 for 10 major UK cities (~418K extra tiles)
npm run tiles:download-uk:cities
```

The downloader is OSM-policy-compliant (2 concurrent connections, rate-limited), resume-safe, and generates a `tiles/manifest.json` when complete.

### 3. Verify

```bash
# Check all services are healthy
docker compose ps

# Test tile serving (should return 200 with PNG)
curl -I http://localhost/osm/10/511/340.png

# Test air-gap (should fail — containers cannot reach internet)
docker exec osm-nextjs-webapp-1 curl -s --connect-timeout 3 https://google.com || echo "Blocked (expected)"
```

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Next.js | 15.1.6 | App framework (standalone mode) |
| React | 19.0.0 | UI library |
| Leaflet | 1.9.4 | Map rendering |
| react-leaflet | 5.0.0 | React bindings for Leaflet |
| TypeScript | 5 | Type safety |
| TailwindCSS | 3.4.1 | Styling |
| Prisma | 6.3.1 | Database ORM |
| PostgreSQL | 17 | User settings storage |
| nginx | alpine | Reverse proxy + tile serving |
| Jest | 29.7.0 | Unit/integration tests |
| Playwright | 1.50.1 | E2E tests |

## Project Structure

```
├── docker-compose.yml         # Full stack: nginx + webapp + db
├── Dockerfile                 # Multi-stage Node 22 build
├── nginx/nginx.conf           # Tile serving + reverse proxy + CSP
├── docker/
│   ├── entrypoint.sh          # DB migrations + tiles setup
│   └── wait-for-db.sh         # PostgreSQL readiness check
├── scripts/
│   ├── download-uk-tiles.sh   # UK tile downloader (pre-deployment)
│   └── warm-cache.sh          # Legacy tile cache warmer
├── tiles/                     # Downloaded tiles (git-ignored, volume-mounted)
├── public/tiles/
│   └── placeholder.png        # 256x256 light gray fallback tile
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── settings/      # GET/POST user map settings
│   │   │   ├── tiles/[z]/[x]/[y]/ # Tile API with disk + placeholder fallback
│   │   │   └── health/        # Health check endpoint
│   │   ├── layout.tsx         # Root layout (local fonts, no CDN)
│   │   └── page.tsx           # Map page
│   ├── components/
│   │   ├── Map/
│   │   │   ├── Map.tsx            # Main map component
│   │   │   └── HighZoomTileLayer  # Tile layer with preloading
│   │   ├── LocationSearch.tsx     # Offline coord search + UK gazetteer
│   │   └── TileComparison.tsx     # Tile info display
│   ├── utils/
│   │   └── tile-utils.ts         # Single local provider, tile math
│   └── fonts/                    # Bundled Geist woff2 fonts
├── prisma/
│   └── schema.prisma             # User, Settings, Marker, Route models
└── tests/                        # Playwright E2E tests
```

## Air-Gap Design

This app makes **zero outbound internet requests** at runtime:

- **Tiles**: Served from local disk by nginx. Missing tiles return a placeholder PNG, not a 404.
- **Fonts**: Bundled as local woff2 files (Geist Sans + Geist Mono). No Google Fonts CDN.
- **Search**: Offline coordinate parser + 50-entry UK gazetteer. No Nominatim API.
- **Icons**: Leaflet marker icons bundled in `public/images/`.
- **CSP**: Locked to `'self' data: blob:` only. No external script/style/connect sources.
- **Docker network**: `internal: true` on the internal network. Webapp and DB physically cannot reach the internet.
- **No CDN proxies**: All external proxy routes have been deleted.

## Tile Serving

Tiles follow the standard slippy map format: `tiles/{z}/{x}/{y}.png`

| URL Pattern | Served by | Fallback |
|------------|-----------|----------|
| `/osm/{z}/{x}/{y}.png` | nginx (direct disk) | `placeholder.png` → 204 |
| `/api/tiles/{z}/{x}/{y}` | nginx → Next.js API | `placeholder.png` → 1x1 transparent PNG |

The tile downloader populates the `tiles/` directory. See `scripts/download-uk-tiles.sh --help` for options.

## Development

```bash
# Install dependencies
npm install

# Start dev server (requires local PostgreSQL)
npm run dev

# Run tests
npm test                    # Jest unit/integration (21 tests)
npm run test:e2e            # Playwright E2E

# Lint
npm run lint
```

## Configuration

Map settings are persisted in PostgreSQL via the Settings API:

- `defaultProvider`: `osm_local` (only provider)
- `defaultZoom`: 0-20
- `defaultCenter`: `{ lat, lng }`

Settings are auto-saved on map interaction (debounced) and restored on page load.

## License

Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
