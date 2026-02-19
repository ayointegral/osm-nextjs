#!/usr/bin/env bash
#
# download-uk-tiles.sh - Download UK map tiles for offline use
#
# Downloads OpenStreetMap tiles covering the United Kingdom at configurable
# zoom levels. Supports parallel downloads, progress reporting, retry logic,
# and optional high-zoom city tiles.
#
# OSM Tile Usage Policy: https://operations.osmfoundation.org/policies/tiles/
# Be respectful - add delays between requests, limit concurrency to 2.
#
# Usage:
#   ./scripts/download-uk-tiles.sh                    # Default: UK z0-z14
#   ./scripts/download-uk-tiles.sh --cities            # + z15-z16 for major cities
#   ./scripts/download-uk-tiles.sh --max-zoom 12       # Lower zoom ceiling
#   ./scripts/download-uk-tiles.sh --dry-run            # Estimate only
#
set -euo pipefail

# ─── Defaults ────────────────────────────────────────────────────────────────

OUTPUT_DIR="./tiles"
MIN_ZOOM=0
MAX_ZOOM=14
CITIES=false
FORCE=false
DRY_RUN=false
TILE_SERVER="https://tile.openstreetmap.org"
CONCURRENCY=2
DELAY=0.1
USER_AGENT="OSMOfflineViewer/1.0 (uk-tile-prefetch)"
YES=false

# UK bounding box
UK_LAT_MIN=49.9
UK_LAT_MAX=60.9
UK_LON_MIN=-8.2
UK_LON_MAX=1.8

# Absolute max zoom allowed
MAX_ZOOM_LIMIT=16

# Minimum free disk space in bytes (10 GB)
MIN_DISK_SPACE_BYTES=10737418240

# Tracking
SCRIPT_START=""
PROGRESS_PID=""
TOTAL_TILES=0
DOWNLOADED_TILES=0
SKIPPED_TILES=0
FAILED_TILES=0
TOTAL_BYTES=0

# Working files (set after OUTPUT_DIR is finalized)
QUEUE_FILE=""
PROGRESS_FILE=""
TOTAL_FILE=""
FAILED_LOG=""

# ─── 1. usage() ─────────────────────────────────────────────────────────────

usage() {
  cat <<'USAGE'
Usage: download-uk-tiles.sh [OPTIONS]

Download UK map tiles from OpenStreetMap for offline use.

Options:
  --output-dir DIR      Output directory (default: ./tiles)
  --min-zoom N          Minimum zoom level (default: 0)
  --max-zoom N          Maximum zoom level (default: 14, max: 16)
  --cities              Also download z15-z16 for 10 major UK cities
  --force               Re-download existing tiles
  --dry-run             Print tile count and size estimate, don't download
  --tile-server URL     Tile server URL (default: https://tile.openstreetmap.org)
  --concurrency N       Parallel downloads (default: 2, max 2 for default server)
  --delay SECONDS       Delay between requests per worker (default: 0.1)
  --user-agent STRING   User-Agent header (default: OSMOfflineViewer/1.0)
  --yes                 Skip confirmation prompt
  --help                Show this help and exit

Strategy:
  z0-z7:   World tiles (full grid) — small, provides zoom-out context
  z8-zN:   UK bounding box only (lat 49.9-60.9, lon -8.2 to 1.8)
  --cities: z15-z16 for London, Manchester, Birmingham, Edinburgh,
            Glasgow, Cardiff, Belfast, Leeds, Bristol, Liverpool

Exit codes:
  0  All tiles downloaded successfully
  1  Some tiles failed (see .failed-tiles.log)
  2  Fatal error or interrupted

Examples:
  download-uk-tiles.sh                          # UK z0-z14
  download-uk-tiles.sh --cities --max-zoom 12   # UK z0-z12 + city z15-z16
  download-uk-tiles.sh --dry-run --cities       # Estimate tile count
  download-uk-tiles.sh --output-dir /data/tiles --yes
USAGE
}

# ─── 2. Logging helpers ─────────────────────────────────────────────────────

log_info() {
  printf '[INFO]  %s\n' "$*"
}

log_warn() {
  printf '[WARN]  %s\n' "$*" >&2
}

log_error() {
  printf '[ERROR] %s\n' "$*" >&2
}

# ─── 3. check_dependencies() ────────────────────────────────────────────────

check_dependencies() {
  local missing=()
  for cmd in curl xargs awk mkdir date; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      missing+=("$cmd")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    log_error "Missing required commands: ${missing[*]}"
    log_error "Please install them and try again."
    exit 2
  fi
}

# ─── 4. check_disk_space() ──────────────────────────────────────────────────

check_disk_space() {
  local dir="$1"

  # Ensure the directory exists for df
  mkdir -p "$dir"

  # Portable: df -k gives 1K blocks on both macOS and Linux
  # Skip header line, take the available column (column 4)
  local avail_kb
  avail_kb=$(df -k "$dir" | awk 'NR==2 {print $4}')

  if [[ -z "$avail_kb" ]]; then
    log_warn "Could not determine free disk space — continuing anyway"
    return 0
  fi

  local avail_bytes=$((avail_kb * 1024))
  local required_gb=$((MIN_DISK_SPACE_BYTES / 1073741824))

  if [[ $avail_bytes -lt $MIN_DISK_SPACE_BYTES ]]; then
    local avail_gb
    avail_gb=$(awk "BEGIN {printf \"%.1f\", $avail_bytes / 1073741824}")
    log_error "Insufficient disk space: ${avail_gb}GB available, ${required_gb}GB required"
    log_error "Free up space or use --output-dir to target a different volume"
    exit 2
  fi

  local avail_gb
  avail_gb=$(awk "BEGIN {printf \"%.1f\", $avail_bytes / 1073741824}")
  log_info "Disk space: ${avail_gb}GB available (${required_gb}GB required)"
}

# ─── 5. parse_args() ────────────────────────────────────────────────────────

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --output-dir)
        [[ $# -lt 2 ]] && { log_error "--output-dir requires a value"; exit 2; }
        OUTPUT_DIR="$2"; shift 2 ;;
      --min-zoom)
        [[ $# -lt 2 ]] && { log_error "--min-zoom requires a value"; exit 2; }
        MIN_ZOOM="$2"; shift 2 ;;
      --max-zoom)
        [[ $# -lt 2 ]] && { log_error "--max-zoom requires a value"; exit 2; }
        MAX_ZOOM="$2"; shift 2 ;;
      --cities)
        CITIES=true; shift ;;
      --force)
        FORCE=true; shift ;;
      --dry-run)
        DRY_RUN=true; shift ;;
      --tile-server)
        [[ $# -lt 2 ]] && { log_error "--tile-server requires a value"; exit 2; }
        TILE_SERVER="$2"; shift 2 ;;
      --concurrency)
        [[ $# -lt 2 ]] && { log_error "--concurrency requires a value"; exit 2; }
        CONCURRENCY="$2"; shift 2 ;;
      --delay)
        [[ $# -lt 2 ]] && { log_error "--delay requires a value"; exit 2; }
        DELAY="$2"; shift 2 ;;
      --user-agent)
        [[ $# -lt 2 ]] && { log_error "--user-agent requires a value"; exit 2; }
        USER_AGENT="$2"; shift 2 ;;
      --yes)
        YES=true; shift ;;
      --help)
        usage; exit 0 ;;
      *)
        log_error "Unknown option: $1"
        usage
        exit 2 ;;
    esac
  done

  # Strip trailing slash from tile server
  TILE_SERVER="${TILE_SERVER%/}"

  # Validate max-zoom
  if [[ $MAX_ZOOM -gt $MAX_ZOOM_LIMIT ]]; then
    log_error "--max-zoom cannot exceed $MAX_ZOOM_LIMIT (got $MAX_ZOOM)"
    exit 2
  fi

  if [[ $MIN_ZOOM -gt $MAX_ZOOM ]]; then
    log_error "--min-zoom ($MIN_ZOOM) cannot exceed --max-zoom ($MAX_ZOOM)"
    exit 2
  fi

  # Enforce concurrency limit for default tile server
  if [[ "$TILE_SERVER" == "https://tile.openstreetmap.org" && $CONCURRENCY -gt 2 ]]; then
    log_warn "Capping concurrency to 2 for default OSM tile server (policy limit)"
    CONCURRENCY=2
  fi

  # Set working file paths
  QUEUE_FILE="${OUTPUT_DIR}/.tile-queue.txt"
  PROGRESS_FILE="${OUTPUT_DIR}/.tile-progress"
  TOTAL_FILE="${OUTPUT_DIR}/.tile-total"
  FAILED_LOG="${OUTPUT_DIR}/.failed-tiles.log"
}

# ─── 6. lon_to_tile_x() ─────────────────────────────────────────────────────

lon_to_tile_x() {
  local lon="$1" zoom="$2"
  awk "BEGIN {
    n = 2 ^ $zoom;
    x = int(($lon + 180.0) / 360.0 * n);
    if (x < 0) x = 0;
    if (x >= n) x = n - 1;
    print x
  }"
}

# ─── 7. lat_to_tile_y() ─────────────────────────────────────────────────────

lat_to_tile_y() {
  local lat="$1" zoom="$2"
  awk "BEGIN {
    pi = 3.14159265358979323846;
    n = 2 ^ $zoom;
    lat_rad = $lat * pi / 180.0;
    y = int((1.0 - log(sin(lat_rad)/cos(lat_rad) + 1.0/cos(lat_rad)) / pi) / 2.0 * n);
    if (y < 0) y = 0;
    if (y >= n) y = n - 1;
    print y
  }"
}

# ─── 8. compute_tile_ranges() ───────────────────────────────────────────────
# For a given bounding box and zoom, output: x_min x_max y_min y_max
# IMPORTANT: higher lat = lower y, so y_min comes from lat_max

compute_tile_range() {
  local lat_min="$1" lat_max="$2" lon_min="$3" lon_max="$4" zoom="$5"

  local x_min x_max y_min y_max
  x_min=$(lon_to_tile_x "$lon_min" "$zoom")
  x_max=$(lon_to_tile_x "$lon_max" "$zoom")
  y_min=$(lat_to_tile_y "$lat_max" "$zoom")  # higher lat = lower y
  y_max=$(lat_to_tile_y "$lat_min" "$zoom")  # lower lat = higher y

  echo "$x_min $x_max $y_min $y_max"
}

# ─── 9. generate_queue() ────────────────────────────────────────────────────

generate_queue() {
  log_info "Computing tile ranges and building download queue..."

  : > "$QUEUE_FILE"

  local z x_min x_max y_min y_max n range

  # z0-z7: World tiles (full grid)
  for ((z = MIN_ZOOM; z <= MAX_ZOOM && z <= 7; z++)); do
    n=$((1 << z))
    x_min=0
    x_max=$((n - 1))
    y_min=0
    y_max=$((n - 1))

    log_info "  z${z}: world tiles ${n}x${n} = $((n * n)) tiles"

    awk -v z="$z" -v xmin="$x_min" -v xmax="$x_max" -v ymin="$y_min" -v ymax="$y_max" \
      'BEGIN { for (x=xmin; x<=xmax; x++) for (y=ymin; y<=ymax; y++) print z"/"x"/"y }' >> "$QUEUE_FILE"
  done

  # z8 to max-zoom: UK bounding box only
  for ((z = 8; z <= MAX_ZOOM; z++)); do
    if [[ $z -lt $MIN_ZOOM ]]; then
      continue
    fi

    range=$(compute_tile_range "$UK_LAT_MIN" "$UK_LAT_MAX" "$UK_LON_MIN" "$UK_LON_MAX" "$z")
    read -r x_min x_max y_min y_max <<< "$range"

    local count=$(( (x_max - x_min + 1) * (y_max - y_min + 1) ))
    log_info "  z${z}: UK bbox x=${x_min}-${x_max} y=${y_min}-${y_max} = ${count} tiles"

    awk -v z="$z" -v xmin="$x_min" -v xmax="$x_max" -v ymin="$y_min" -v ymax="$y_max" \
      'BEGIN { for (x=xmin; x<=xmax; x++) for (y=ymin; y<=ymax; y++) print z"/"x"/"y }' >> "$QUEUE_FILE"
  done

  # City tiles at z15-z16 if --cities
  if [[ "$CITIES" == "true" ]]; then
    log_info "  Adding city tiles at z15-z16..."

    # City bounding boxes: name lat_min lat_max lon_min lon_max
    local -a city_data=(
      "London:51.28:51.69:-0.51:0.33"
      "Manchester:53.35:53.55:-2.35:-2.15"
      "Birmingham:52.40:52.55:-1.98:-1.75"
      "Edinburgh:55.90:55.98:-3.25:-3.10"
      "Glasgow:55.83:55.90:-4.32:-4.20"
      "Cardiff:51.45:51.52:-3.22:-3.13"
      "Belfast:54.57:54.62:-5.97:-5.87"
      "Leeds:53.75:53.83:-1.60:-1.50"
      "Bristol:51.42:51.49:-2.63:-2.55"
      "Liverpool:53.38:53.45:-3.02:-2.90"
    )

    local city_entry city_name c_lat_min c_lat_max c_lon_min c_lon_max
    for city_entry in "${city_data[@]}"; do
      IFS=':' read -r city_name c_lat_min c_lat_max c_lon_min c_lon_max <<< "$city_entry"

      for ((z = 15; z <= 16; z++)); do
        range=$(compute_tile_range "$c_lat_min" "$c_lat_max" "$c_lon_min" "$c_lon_max" "$z")
        read -r x_min x_max y_min y_max <<< "$range"

        local count=$(( (x_max - x_min + 1) * (y_max - y_min + 1) ))
        log_info "    ${city_name} z${z}: x=${x_min}-${x_max} y=${y_min}-${y_max} = ${count} tiles"

        awk -v z="$z" -v xmin="$x_min" -v xmax="$x_max" -v ymin="$y_min" -v ymax="$y_max" \
          'BEGIN { for (x=xmin; x<=xmax; x++) for (y=ymin; y<=ymax; y++) print z"/"x"/"y }' >> "$QUEUE_FILE"
      done
    done
  fi

  # Deduplicate (city tiles at z15-z16 might overlap with UK bbox if max-zoom >= 15)
  if [[ -s "$QUEUE_FILE" ]]; then
    sort -u "$QUEUE_FILE" > "${QUEUE_FILE}.dedup"
    mv "${QUEUE_FILE}.dedup" "$QUEUE_FILE"
  fi

  TOTAL_TILES=$(wc -l < "$QUEUE_FILE" | tr -d ' ')
  echo "$TOTAL_TILES" > "$TOTAL_FILE"

  log_info "Total tiles in queue: $(printf "%'d" "$TOTAL_TILES")"
}

# ─── 10. setup_placeholder() ────────────────────────────────────────────────

setup_placeholder() {
  local placeholder_dest="${OUTPUT_DIR}/placeholder.png"

  if [[ -f "$placeholder_dest" ]]; then
    log_info "Placeholder already exists at ${placeholder_dest}"
    return 0
  fi

  # Try to copy from public/tiles/placeholder.png
  local project_placeholder="public/tiles/placeholder.png"
  if [[ -f "$project_placeholder" ]]; then
    cp "$project_placeholder" "$placeholder_dest"
    log_info "Copied placeholder from ${project_placeholder}"
    return 0
  fi

  # Generate a minimal 256x256 light gray PNG via base64
  # This is a valid 256x256 single-color (#E0E0E0) PNG
  log_info "Generating placeholder PNG..."
  base64 -d <<'B64PNG' > "$placeholder_dest"
iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADPMO6xAAAAH0lEQVR42u3BAQ0AAADCoPdP
bQ43oAAAAAAAAAAAAAAAvgxeAAH/0DljAAAAAElFTkSuQmCC
B64PNG

  # Verify it was created
  if [[ -f "$placeholder_dest" ]]; then
    log_info "Generated placeholder PNG at ${placeholder_dest}"
  else
    log_warn "Failed to generate placeholder PNG — continuing without it"
  fi
}

# ─── 11. download_tile() ────────────────────────────────────────────────────
# Called by xargs for each tile. Exported as a function.
# Arguments: z/x/y (single string like "12/2048/1361")

download_tile() {
  local tile_path="$1"
  local z x y
  IFS='/' read -r z x y <<< "$tile_path"

  local out_file="${DL_OUTPUT_DIR}/${z}/${x}/${y}.png"
  local url="${DL_TILE_SERVER}/${z}/${x}/${y}.png"

  # Skip existing tiles unless --force
  if [[ "$DL_FORCE" != "true" && -f "$out_file" ]]; then
    local file_size
    file_size=$(wc -c < "$out_file" 2>/dev/null | tr -d ' ')
    if [[ "$file_size" -gt 67 ]]; then
      # Count as success for progress
      echo "s" >> "$DL_PROGRESS_FILE"
      return 0
    fi
  fi

  # Ensure directory exists
  mkdir -p "${DL_OUTPUT_DIR}/${z}/${x}"

  # Download
  if curl --proto =https,http --silent --show-error --fail \
       --retry 3 --retry-delay 5 --retry-max-time 30 \
       --connect-timeout 10 --max-time 30 \
       --header "User-Agent: ${DL_USER_AGENT}" \
       --output "$out_file" \
       "$url" 2>/dev/null; then

    # Validate PNG magic bytes: 89 50 4E 47
    if [[ -f "$out_file" ]]; then
      local magic
      magic=$(od -A n -t x1 -N 4 "$out_file" 2>/dev/null | tr -d ' ')
      if [[ "$magic" == "89504e47" ]]; then
        echo "d" >> "$DL_PROGRESS_FILE"
      else
        rm -f "$out_file"
        echo "$tile_path" >> "$DL_FAILED_LOG"
        echo "f" >> "$DL_PROGRESS_FILE"
      fi
    else
      echo "$tile_path" >> "$DL_FAILED_LOG"
      echo "f" >> "$DL_PROGRESS_FILE"
    fi
  else
    rm -f "$out_file"
    echo "$tile_path" >> "$DL_FAILED_LOG"
    echo "f" >> "$DL_PROGRESS_FILE"
  fi

  # Rate limiting
  sleep "$DL_DELAY"
}

# Export the function and variables for xargs subshells
export -f download_tile

# ─── 12. start_progress_reporter() ──────────────────────────────────────────

start_progress_reporter() {
  local total_file="$1"
  local progress_file="$2"
  local failed_log="$3"
  local start_time="$4"

  (
    while true; do
      sleep 5

      # Safely read counts
      local total=0 current=0 failed=0
      if [[ -f "$total_file" ]]; then
        total=$(cat "$total_file" 2>/dev/null || echo 0)
      fi
      if [[ -f "$progress_file" ]]; then
        current=$(wc -l < "$progress_file" 2>/dev/null | tr -d ' ')
      fi
      if [[ -f "$failed_log" ]]; then
        failed=$(wc -l < "$failed_log" 2>/dev/null | tr -d ' ')
      fi

      if [[ "$total" -eq 0 ]]; then
        continue
      fi

      # Calculate percentage
      local pct
      pct=$(awk "BEGIN { printf \"%.1f\", ($current / $total) * 100 }")

      # Calculate rate and ETA
      local now elapsed rate eta_str
      now=$(date +%s)
      elapsed=$((now - start_time))
      if [[ $elapsed -gt 0 && $current -gt 0 ]]; then
        rate=$(awk "BEGIN { printf \"%.0f\", ($current / $elapsed) * 60 }")
        local remaining=$((total - current))
        local rate_per_sec
        rate_per_sec=$(awk "BEGIN { r = $current / $elapsed; print (r > 0) ? r : 1 }")
        local eta_secs
        eta_secs=$(awk "BEGIN { printf \"%.0f\", $remaining / $rate_per_sec }")
        local eta_h eta_m
        eta_h=$((eta_secs / 3600))
        eta_m=$(( (eta_secs % 3600) / 60 ))
        eta_str="${eta_h}h $(printf '%02d' $eta_m)m"
      else
        rate=0
        eta_str="calculating..."
      fi

      # Determine current zoom from queue (approximate from last line of progress)
      local current_formatted total_formatted rate_formatted
      current_formatted=$(printf "%'d" "$current" 2>/dev/null || echo "$current")
      total_formatted=$(printf "%'d" "$total" 2>/dev/null || echo "$total")
      rate_formatted=$(printf "%'d" "$rate" 2>/dev/null || echo "$rate")

      printf '\r[progress] %s / %s tiles (%s%%) | %s tiles/min | ETA: %s | Failed: %d    ' \
        "$current_formatted" "$total_formatted" "$pct" \
        "$rate_formatted" "$eta_str" "$failed"
    done
  ) &

  PROGRESS_PID=$!
}

# ─── 13. download_tiles() ───────────────────────────────────────────────────

download_tiles() {
  log_info "Starting download with concurrency=${CONCURRENCY}, delay=${DELAY}s..."

  # Clear progress tracking files
  : > "$PROGRESS_FILE"
  : > "$FAILED_LOG"

  # Export variables for download_tile function in xargs subshells
  export DL_OUTPUT_DIR="$OUTPUT_DIR"
  export DL_TILE_SERVER="$TILE_SERVER"
  export DL_USER_AGENT="$USER_AGENT"
  export DL_FORCE="$FORCE"
  export DL_DELAY="$DELAY"
  export DL_PROGRESS_FILE="$PROGRESS_FILE"
  export DL_FAILED_LOG="$FAILED_LOG"

  # Start progress reporter
  local start_epoch
  start_epoch=$(date +%s)
  start_progress_reporter "$TOTAL_FILE" "$PROGRESS_FILE" "$FAILED_LOG" "$start_epoch"

  # Fan out downloads via xargs
  xargs -P "$CONCURRENCY" -I {} bash -c 'download_tile "$@"' _ {} < "$QUEUE_FILE"

  # Stop progress reporter
  if [[ -n "$PROGRESS_PID" ]]; then
    kill "$PROGRESS_PID" 2>/dev/null || true
    wait "$PROGRESS_PID" 2>/dev/null || true
    PROGRESS_PID=""
  fi

  # Final newline after progress output
  echo ""

  # Count results
  if [[ -f "$PROGRESS_FILE" ]]; then
    local total_processed
    total_processed=$(wc -l < "$PROGRESS_FILE" | tr -d ' ')
    DOWNLOADED_TILES=$(grep -c '^d$' "$PROGRESS_FILE" 2>/dev/null) || DOWNLOADED_TILES=0
    SKIPPED_TILES=$(grep -c '^s$' "$PROGRESS_FILE" 2>/dev/null) || SKIPPED_TILES=0
    FAILED_TILES=$(grep -c '^f$' "$PROGRESS_FILE" 2>/dev/null) || FAILED_TILES=0
  fi

  log_info "Download pass complete: ${DOWNLOADED_TILES} downloaded, ${SKIPPED_TILES} skipped, ${FAILED_TILES} failed"
}

# ─── 14. retry_failed() ─────────────────────────────────────────────────────

retry_failed() {
  if [[ ! -s "$FAILED_LOG" ]]; then
    log_info "No failed tiles to retry"
    return 0
  fi

  local fail_count
  fail_count=$(wc -l < "$FAILED_LOG" | tr -d ' ')
  log_warn "${fail_count} tiles failed — retrying in 30 seconds..."
  sleep 30

  # Save failed list and clear for retry
  local retry_queue="${OUTPUT_DIR}/.retry-queue.txt"
  cp "$FAILED_LOG" "$retry_queue"
  : > "$FAILED_LOG"

  # Clear progress file markers for retry count
  local retry_progress="${OUTPUT_DIR}/.retry-progress"
  : > "$retry_progress"

  export DL_PROGRESS_FILE="$retry_progress"

  log_info "Retrying ${fail_count} failed tiles..."
  xargs -P "$CONCURRENCY" -I {} bash -c 'download_tile "$@"' _ {} < "$retry_queue"

  # Count retry results
  local retry_downloaded=0 retry_failed=0
  if [[ -f "$retry_progress" ]]; then
    retry_downloaded=$(grep -c '^d$' "$retry_progress" 2>/dev/null) || retry_downloaded=0
    retry_failed=$(grep -c '^f$' "$retry_progress" 2>/dev/null) || retry_failed=0
  fi

  DOWNLOADED_TILES=$((DOWNLOADED_TILES + retry_downloaded))
  FAILED_TILES=$((FAILED_TILES - retry_downloaded))
  if [[ $FAILED_TILES -lt 0 ]]; then
    FAILED_TILES=0
  fi

  # Update failed count from the log
  if [[ -s "$FAILED_LOG" ]]; then
    FAILED_TILES=$(wc -l < "$FAILED_LOG" | tr -d ' ')
    log_warn "${FAILED_TILES} tiles still failed after retry"
  else
    FAILED_TILES=0
    log_info "All retried tiles succeeded"
  fi

  # Clean up retry files
  rm -f "$retry_queue" "$retry_progress"
}

# ─── 15. write_manifest() ───────────────────────────────────────────────────

write_manifest() {
  local manifest="${OUTPUT_DIR}/manifest.json"
  local manifest_tmp="${manifest}.tmp"

  local generated
  generated=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  local escaped_server
  escaped_server=$(printf '%s' "$TILE_SERVER" | sed 's/\\/\\\\/g; s/"/\\"/g')

  local end_epoch
  end_epoch=$(date +%s)
  local duration=$((end_epoch - SCRIPT_START))

  # Calculate total size of tiles directory
  TOTAL_BYTES=$(du -sk "$OUTPUT_DIR" 2>/dev/null | awk '{print $1 * 1024}')

  # Build regions JSON
  local regions_json="{\"uk\":{\"lat_min\":${UK_LAT_MIN},\"lat_max\":${UK_LAT_MAX},\"lon_min\":${UK_LON_MIN},\"lon_max\":${UK_LON_MAX},\"min_zoom\":${MIN_ZOOM},\"max_zoom\":${MAX_ZOOM}}"

  if [[ "$CITIES" == "true" ]]; then
    regions_json="${regions_json},\"cities\":{\"zoom_min\":15,\"zoom_max\":16,\"cities\":[\"London\",\"Manchester\",\"Birmingham\",\"Edinburgh\",\"Glasgow\",\"Cardiff\",\"Belfast\",\"Leeds\",\"Bristol\",\"Liverpool\"]}"
  fi
  regions_json="${regions_json}}"

  # Build failed tiles array
  local failed_json="[]"
  if [[ -s "$FAILED_LOG" ]]; then
    failed_json="["
    local first=true
    while IFS= read -r line; do
      if [[ "$first" == "true" ]]; then
        failed_json="${failed_json}\"${line}\""
        first=false
      else
        failed_json="${failed_json},\"${line}\""
      fi
    done < "$FAILED_LOG"
    failed_json="${failed_json}]"
  fi

  cat > "$manifest_tmp" <<EOF
{
  "generated": "${generated}",
  "generator": "download-uk-tiles.sh",
  "tile_server": "${escaped_server}",
  "regions": ${regions_json},
  "tiles": {
    "total": ${TOTAL_TILES},
    "downloaded": ${DOWNLOADED_TILES},
    "skipped": ${SKIPPED_TILES},
    "failed": ${FAILED_TILES},
    "size_bytes": ${TOTAL_BYTES}
  },
  "duration_seconds": ${duration},
  "failed_tiles": ${failed_json}
}
EOF

  mv "$manifest_tmp" "$manifest"
  log_info "Manifest written to ${manifest}"
}

# ─── 16. print_summary() ────────────────────────────────────────────────────

print_summary() {
  local end_epoch
  end_epoch=$(date +%s)
  local duration=$((end_epoch - SCRIPT_START))
  local hours=$((duration / 3600))
  local minutes=$(( (duration % 3600) / 60 ))
  local seconds=$((duration % 60))

  local size_human
  size_human=$(du -sh "$OUTPUT_DIR" 2>/dev/null | awk '{print $1}')

  echo ""
  echo "═══════════════════════════════════════════════════════"
  echo "  UK Tile Download Complete"
  echo "═══════════════════════════════════════════════════════"
  printf "  Total tiles:      %'d\n" "$TOTAL_TILES"
  printf "  Downloaded:       %'d\n" "$DOWNLOADED_TILES"
  printf "  Skipped (cached): %'d\n" "$SKIPPED_TILES"
  printf "  Failed:           %'d\n" "$FAILED_TILES"
  echo "  Tile cache size:  ${size_human}"
  printf "  Duration:         %dh %02dm %02ds\n" "$hours" "$minutes" "$seconds"
  echo "  Output:           ${OUTPUT_DIR}"
  echo "═══════════════════════════════════════════════════════"

  if [[ $FAILED_TILES -gt 0 ]]; then
    echo ""
    log_warn "Some tiles failed. See: ${FAILED_LOG}"
    log_warn "Re-run the script to retry failed tiles (existing tiles will be skipped)."
  fi

  echo ""
  echo "Mount this directory in docker-compose.yml:"
  echo "  volumes:"
  echo "    - ${OUTPUT_DIR}:/app/tiles:ro"
  echo ""
}

# ─── 17. cleanup() ──────────────────────────────────────────────────────────

cleanup() {
  local exit_code="${1:-$?}"

  # Kill progress reporter if running
  if [[ -n "${PROGRESS_PID:-}" ]]; then
    kill "$PROGRESS_PID" 2>/dev/null || true
    wait "$PROGRESS_PID" 2>/dev/null || true
    PROGRESS_PID=""
  fi

  # Clean up temporary files (but keep failed log and manifest)
  rm -f "${OUTPUT_DIR:-.}/.tile-queue.txt" 2>/dev/null || true
  rm -f "${OUTPUT_DIR:-.}/.tile-progress" 2>/dev/null || true
  rm -f "${OUTPUT_DIR:-.}/.tile-total" 2>/dev/null || true
  rm -f "${OUTPUT_DIR:-.}/.retry-queue.txt" 2>/dev/null || true
  rm -f "${OUTPUT_DIR:-.}/.retry-progress" 2>/dev/null || true

  return 0
}

# Signal handler for SIGINT/SIGTERM
handle_signal() {
  echo ""
  log_warn "Interrupted! Cleaning up..."

  # Kill progress reporter
  if [[ -n "${PROGRESS_PID:-}" ]]; then
    kill "$PROGRESS_PID" 2>/dev/null || true
    wait "$PROGRESS_PID" 2>/dev/null || true
    PROGRESS_PID=""
  fi

  # Print partial summary if we have data
  if [[ -f "${PROGRESS_FILE:-}" ]]; then
    local partial_done
    partial_done=$(wc -l < "$PROGRESS_FILE" 2>/dev/null | tr -d ' ')
    echo ""
    echo "── Partial Summary (interrupted) ──"
    printf "  Processed: %'d / %'d tiles\n" "$partial_done" "$TOTAL_TILES"
    if [[ -s "${FAILED_LOG:-}" ]]; then
      local partial_failed
      partial_failed=$(wc -l < "$FAILED_LOG" | tr -d ' ')
      printf "  Failed:    %'d\n" "$partial_failed"
    fi
    echo "  Re-run the script to resume (existing tiles will be skipped)."
    echo ""
  fi

  cleanup
  exit 2
}

# ─── 18. main() ─────────────────────────────────────────────────────────────

main() {
  parse_args "$@"

  echo ""
  echo "╔═══════════════════════════════════════════════════════╗"
  echo "║         UK OpenStreetMap Tile Downloader              ║"
  echo "╚═══════════════════════════════════════════════════════╝"
  echo ""

  check_dependencies

  SCRIPT_START=$(date +%s)

  # Set up traps
  trap handle_signal SIGINT SIGTERM
  trap cleanup EXIT

  # Create output directory
  mkdir -p "$OUTPUT_DIR"

  # Check disk space (skip for dry run)
  if [[ "$DRY_RUN" != "true" ]]; then
    check_disk_space "$OUTPUT_DIR"
  fi

  # Print configuration
  log_info "Configuration:"
  log_info "  Output:      ${OUTPUT_DIR}"
  log_info "  Zoom:        ${MIN_ZOOM}-${MAX_ZOOM}"
  log_info "  Cities:      ${CITIES}"
  log_info "  Force:       ${FORCE}"
  log_info "  Tile server: ${TILE_SERVER}"
  log_info "  Concurrency: ${CONCURRENCY}"
  log_info "  Delay:       ${DELAY}s"
  echo ""

  # Generate the download queue
  generate_queue

  # Dry run: estimate and exit
  if [[ "$DRY_RUN" == "true" ]]; then
    echo ""
    log_info "=== DRY RUN ESTIMATE ==="
    printf "  Total tiles: %'d\n" "$TOTAL_TILES"

    # Estimate size: average ~15KB per tile for lower zooms, ~20KB for higher
    local est_bytes
    est_bytes=$(awk "BEGIN { printf \"%.0f\", $TOTAL_TILES * 18000 }")
    local est_gb
    est_gb=$(awk "BEGIN { printf \"%.1f\", $est_bytes / 1073741824 }")
    local est_mb
    est_mb=$(awk "BEGIN { printf \"%.0f\", $est_bytes / 1048576 }")

    echo "  Estimated size: ~${est_mb}MB (~${est_gb}GB)"

    # Estimate time: tiles / (concurrency / delay)
    local est_seconds
    est_seconds=$(awk "BEGIN {
      rate = $CONCURRENCY / ($DELAY + 0.15);
      printf \"%.0f\", $TOTAL_TILES / rate
    }")
    local est_h=$((est_seconds / 3600))
    local est_m=$(( (est_seconds % 3600) / 60 ))
    printf "  Estimated time: ~%dh %02dm (at %d concurrent, %.1fs delay)\n" \
      "$est_h" "$est_m" "$CONCURRENCY" "$DELAY"

    echo ""
    log_info "Run without --dry-run to start downloading."
    cleanup
    exit 0
  fi

  # Confirmation prompt
  if [[ "$YES" != "true" ]]; then
    echo ""
    printf "Proceed with downloading %'d tiles? [y/N] " "$TOTAL_TILES"
    read -r confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" && "$confirm" != "yes" ]]; then
      log_info "Aborted by user."
      cleanup
      exit 0
    fi
  fi

  echo ""

  # Set up placeholder
  setup_placeholder

  # Download tiles
  download_tiles

  # Retry failed tiles
  retry_failed

  # Write manifest
  write_manifest

  # Print summary
  print_summary

  # Clean up temp files
  cleanup

  # Exit code based on failures
  if [[ $FAILED_TILES -gt 0 ]]; then
    exit 1
  fi
  exit 0
}

# ─── Entry point ─────────────────────────────────────────────────────────────

main "$@"
