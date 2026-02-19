#!/usr/bin/env bash
#
# warm-cache.sh - Download OSM tiles for offline use
#
# Run this script ONCE while connected to the internet.
# It downloads tiles from tile.openstreetmap.org into ./tiles/
# Then mount ./tiles as a read-only volume in Docker.
#
# Usage:
#   ./scripts/warm-cache.sh                          # Default: London, zoom 0-14
#   ./scripts/warm-cache.sh --bbox "-0.5,51.3,0.3,51.7" --zoom 0-16
#   ./scripts/warm-cache.sh --bbox "-74.3,40.4,-73.7,40.9" --zoom 0-15  # NYC
#   ./scripts/warm-cache.sh --world --zoom 0-5       # Whole world at low zoom
#
# OSM Tile Usage Policy: https://operations.osmfoundation.org/policies/tiles/
# Be respectful - add delays between requests, don't hammer the servers.

set -euo pipefail

TILE_DIR="./tiles"
TILE_SERVER="https://tile.openstreetmap.org"
USER_AGENT="OSM-Offline-Cache-Warmer/1.0"
DELAY=0.1        # seconds between requests (be nice to OSM servers)
MAX_PARALLEL=2   # concurrent downloads (OSM policy: max 2)
BBOX=""
ZOOM_MIN=0
ZOOM_MAX=14
WORLD=false

usage() {
  echo "Usage: $0 [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  --bbox \"west,south,east,north\"   Bounding box (default: London)"
  echo "  --zoom MIN-MAX                     Zoom range (default: 0-14)"
  echo "  --world                            Download entire world (use with low zoom)"
  echo "  --delay SECONDS                    Delay between requests (default: 0.1)"
  echo "  --output DIR                       Output directory (default: ./tiles)"
  echo "  --help                             Show this help"
  echo ""
  echo "Examples:"
  echo "  $0 --bbox \"-0.5,51.3,0.3,51.7\" --zoom 0-16        # London"
  echo "  $0 --bbox \"-74.3,40.4,-73.7,40.9\" --zoom 0-15     # New York"
  echo "  $0 --bbox \"2.2,48.8,2.5,48.9\" --zoom 0-16         # Paris"
  echo "  $0 --world --zoom 0-6                                # World overview"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bbox) BBOX="$2"; shift 2 ;;
    --zoom) IFS='-' read -r ZOOM_MIN ZOOM_MAX <<< "$2"; shift 2 ;;
    --world) WORLD=true; shift ;;
    --delay) DELAY="$2"; shift 2 ;;
    --output) TILE_DIR="$2"; shift 2 ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown option: $1"; usage; exit 1 ;;
  esac
done

# Default bounding box: London
if [[ -z "$BBOX" && "$WORLD" == "false" ]]; then
  BBOX="-0.5,51.3,0.3,51.7"
fi

if [[ "$WORLD" == "true" ]]; then
  BBOX="-180,-85.0511,180,85.0511"
fi

IFS=',' read -r WEST SOUTH EAST NORTH <<< "$BBOX"

echo "=== OSM Tile Cache Warmer ==="
echo "Bounding box: W=$WEST S=$SOUTH E=$EAST N=$NORTH"
echo "Zoom range:   $ZOOM_MIN - $ZOOM_MAX"
echo "Output:       $TILE_DIR"
echo "Delay:        ${DELAY}s between requests"
echo ""

# Convert lat/lon to tile coordinates
lon2tile() {
  local lon=$1 zoom=$2
  echo "$(echo "$lon $zoom" | awk '{printf "%d", ($1 + 180) / 360 * 2^$2}')"
}

lat2tile() {
  local lat=$1 zoom=$2
  echo "$(echo "$lat $zoom" | awk '{
    lat_rad = $1 * 3.14159265358979 / 180;
    printf "%d", (1 - log(sin(lat_rad) + 1/cos(lat_rad)) / 3.14159265358979) / 2 * 2^$2
  }')"
}

TOTAL=0
DOWNLOADED=0
SKIPPED=0
FAILED=0

# Count total tiles first
for ((z=ZOOM_MIN; z<=ZOOM_MAX; z++)); do
  x_min=$(lon2tile "$WEST" "$z")
  x_max=$(lon2tile "$EAST" "$z")
  y_min=$(lat2tile "$NORTH" "$z")  # Note: lat/y is inverted
  y_max=$(lat2tile "$SOUTH" "$z")

  for ((x=x_min; x<=x_max; x++)); do
    for ((y=y_min; y<=y_max; y++)); do
      TOTAL=$((TOTAL + 1))
    done
  done
done

echo "Total tiles to download: $TOTAL"
echo ""

# Download tiles
CURRENT=0
for ((z=ZOOM_MIN; z<=ZOOM_MAX; z++)); do
  x_min=$(lon2tile "$WEST" "$z")
  x_max=$(lon2tile "$EAST" "$z")
  y_min=$(lat2tile "$NORTH" "$z")
  y_max=$(lat2tile "$SOUTH" "$z")

  tile_count=$(( (x_max - x_min + 1) * (y_max - y_min + 1) ))
  echo "Zoom $z: ${tile_count} tiles (x: $x_min-$x_max, y: $y_min-$y_max)"

  for ((x=x_min; x<=x_max; x++)); do
    mkdir -p "${TILE_DIR}/${z}/${x}"
    for ((y=y_min; y<=y_max; y++)); do
      CURRENT=$((CURRENT + 1))
      tile_path="${TILE_DIR}/${z}/${x}/${y}.png"

      # Skip if already downloaded
      if [[ -f "$tile_path" && -s "$tile_path" ]]; then
        SKIPPED=$((SKIPPED + 1))
        continue
      fi

      url="${TILE_SERVER}/${z}/${x}/${y}.png"

      if curl -sS -f -o "$tile_path" \
           -H "User-Agent: $USER_AGENT" \
           --connect-timeout 10 \
           --max-time 30 \
           "$url" 2>/dev/null; then
        DOWNLOADED=$((DOWNLOADED + 1))
      else
        FAILED=$((FAILED + 1))
        rm -f "$tile_path"
      fi

      # Progress
      if (( CURRENT % 100 == 0 )); then
        pct=$(( CURRENT * 100 / TOTAL ))
        echo "  Progress: ${CURRENT}/${TOTAL} (${pct}%) - Downloaded: ${DOWNLOADED}, Skipped: ${SKIPPED}, Failed: ${FAILED}"
      fi

      sleep "$DELAY"
    done
  done
done

echo ""
echo "=== Done ==="
echo "Total:      $TOTAL"
echo "Downloaded: $DOWNLOADED"
echo "Skipped:    $SKIPPED (already cached)"
echo "Failed:     $FAILED"
echo ""

# Calculate size
TILE_SIZE=$(du -sh "$TILE_DIR" 2>/dev/null | cut -f1)
echo "Tile cache size: $TILE_SIZE"
echo ""
echo "Mount this directory as a read-only volume in docker-compose.yml:"
echo "  volumes:"
echo "    - ./tiles:/app/tiles:ro"
