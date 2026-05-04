# GeneralDeterrence Staging Host Runbook

This repo can be staged on the AdGuard Hetzner host. Keep this deployment
additive-only: do not alter how the existing AdGuard, monitor, sync, ntfy, or
DNS-over-HTTPS services are accessed.

## Host

- Tailscale name: `adguard-cloud-hetzner`
- Tailscale IP: `100.69.57.107`
- Public IP: `89.167.53.198`
- Hostname on server: `adguard-cloud`
- OS observed: Ubuntu 24.04.4 LTS
- SSH path: `ssh root@100.69.57.107`
- SSH access may require a Tailscale approval check.

Do not confuse this host with the Facet Cloud Hetzner host:

- Facet Cloud host: `facet-cloud-01`
- Facet Cloud public IP: `46.62.131.2`
- Facet Cloud Tailscale IP: `100.105.64.96`

## Existing Services On AdGuard Host

Observed running services:

- `AdGuardHome.service`
- `docker.service`
- `tailscaled.service`

Observed containers:

- `caddy` using image `caddy:2`
- `ntfy` using image `binwiederhier/ntfy`
- `uptime-kuma` using image `louislam/uptime-kuma:2`
- `adguardhome-sync` using image `ghcr.io/bakito/adguardhome-sync:latest`
- `chromium` using image `browserless/chrome:latest`

Important ports already in use:

- `80`, `443`: Caddy
- `53`, `853`, `3000`, `6060`: AdGuard Home
- `3001`: monitor / Uptime Kuma node process
- `8080`: AdGuard sync
- `8082`: ntfy
- `3200`: browserless Chromium
- `5335`: local unbound

Capacity observed on 2026-05-04:

- Disk: 38G total, about 27G free
- Memory: 3.7G total, about 2.5G available

## Caddy

Caddy config path:

```bash
/opt/caddy/Caddyfile
```

Existing Caddy hostnames observed:

- `dns.esponet.me`
- `adguard.esponet.me`
- `monitor.esponet.me`
- `sync.esponet.me`
- `ntfy.esponet.me`

These existing blocks use `tls internal`. Do not change them for the game.
If exposing the game publicly, add a new hostname block only.

## Game Image

The repo documents this image:

```bash
ghcr.io/jesposito/generaldeterrence:latest
```

The AdGuard host was able to inspect the manifest for this image on
2026-05-04. It includes a Linux `amd64` manifest, which matches the host.

## Recommended Additive Deployment Shape

Use a dedicated container, data directory, localhost-only port, and hostname.
This keeps the game isolated from existing services.

Suggested local paths and names:

- Container name: `general-deterrence-staging`
- Data directory: `/opt/general-deterrence/data`
- Host port: `127.0.0.1:3100`
- Candidate hostname: `gd.esponet.me` or `game.esponet.me`

Suggested container command:

```bash
mkdir -p /opt/general-deterrence/data

docker run -d \
  --name general-deterrence-staging \
  --restart unless-stopped \
  --pull always \
  -p 127.0.0.1:3100:3000 \
  -v /opt/general-deterrence/data:/data \
  -e PORT=3000 \
  -e DATA_DIR=/data \
  ghcr.io/jesposito/generaldeterrence:latest
```

Suggested Caddy block for public HTTPS:

```caddyfile
gd.esponet.me {
    reverse_proxy 127.0.0.1:3100
}
```

Suggested Caddy block if keeping the same private internal-TLS style as the
other hostnames:

```caddyfile
gd.esponet.me {
    tls internal
    reverse_proxy 127.0.0.1:3100
}
```

Use public HTTPS for police-issued phones unless the required internal CA is
already trusted on those devices. PWA/mobile browser behavior is usually
simpler with publicly trusted TLS.

## Current Staging Deployment

Deployed on 2026-05-04:

- Public URL: `https://gd.esponet.me`
- Alternate URL: `https://game.esponet.me`
- Cloudflare DNS record id: `e4352e6be79b0bd1eb2b126e5ede09b6`
- Alternate Cloudflare DNS record id: `c747b9968057d3ca5bd9566242ce71be`
- DNS record: proxied `A` record, `gd.esponet.me -> 89.167.53.198`
- Alternate DNS record: proxied `A` record, `game.esponet.me -> 89.167.53.198`
- Container: `general-deterrence-staging`
- Image digest observed during pull: `sha256:63b61b3fd8856579a4d0ebc6fa11851d6a5ea2aa9de9f4585f600ee01ee16f4c`
- Host bind: `127.0.0.1:3100 -> container :3000`
- Data directory: `/opt/general-deterrence/data`
- Caddy backup before route add: `/opt/caddy/Caddyfile.before-gd-20260504-003211`
- Caddy backup before alternate route add: `/opt/caddy/Caddyfile.before-game-20260504-003711`

The container was recreated once to override the image healthcheck. The image
healthcheck uses `localhost`, which resolved to IPv6 `::1` inside the Alpine
container while the Node app was reachable on IPv4. The deployed container uses
this IPv4 healthcheck:

```bash
--health-cmd="wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1"
```

Current deployed command shape:

```bash
docker run -d \
  --name general-deterrence-staging \
  --restart unless-stopped \
  --pull always \
  -p 127.0.0.1:3100:3000 \
  -v /opt/general-deterrence/data:/data \
  -e PORT=3000 \
  -e DATA_DIR=/data \
  --health-cmd="wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1" \
  --health-interval=30s \
  --health-timeout=3s \
  --health-start-period=5s \
  --health-retries=3 \
  ghcr.io/jesposito/generaldeterrence:latest
```

Verification after deployment:

- `https://gd.esponet.me` returned HTTP 200 through Cloudflare.
- `https://gd.esponet.me/api/health` returned `{"status":"ok","db":"sqlite"}`.
- `https://game.esponet.me` returned HTTP 200 through Cloudflare.
- `https://game.esponet.me/api/health` returned `{"status":"ok","db":"sqlite"}`.
- Docker health for `general-deterrence-staging` was `healthy`.
- Existing `adguard.esponet.me` and `monitor.esponet.me` still returned their
  Cloudflare Access redirects.
- Existing `ntfy.esponet.me` returned HTTP 200.

If a device saw `ERR_NAME_NOT_RESOLVED` for `gd.esponet.me` immediately after
creation, it may have cached a negative lookup from before the DNS record
existed. Use `game.esponet.me` as the alternate test hostname or clear the
device/browser DNS cache.

## DNS

`gd.esponet.me`, `generaldeterrence.esponet.me`, and `game.esponet.me` did not
resolve from the AdGuard host during inspection on 2026-05-04.

Existing `adguard.esponet.me` and `monitor.esponet.me` resolved through
Cloudflare anycast IPv6, so DNS for a new public hostname likely needs to be
created wherever `esponet.me` is managed.

Cloudflare access was verified on 2026-05-04 using the existing Facet Cloud
Cloudflare token from local secrets. Do not write token values into this repo.

Observed Cloudflare zone:

- Zone: `esponet.me`
- Zone id: `0107333a493bf09049f14bae2df7cf68`
- Status: `active`
- Type: `full`

Observed DNS records:

- `gd.esponet.me`: proxied `A` record to `89.167.53.198`
- `game.esponet.me`: proxied `A` record to `89.167.53.198`
- `adguard.esponet.me`: proxied `A` record to `89.167.53.198`

Safe DNS shape for the game:

- Add a new proxied `A` record for `gd.esponet.me` to `89.167.53.198`
- Leave every existing `esponet.me` record unchanged

Do not modify existing DNS records for:

- `dns.esponet.me`
- `adguard.esponet.me`
- `monitor.esponet.me`
- `sync.esponet.me`
- `ntfy.esponet.me`

Add only the new game hostname.

## Verification Commands

After starting the container:

```bash
docker ps --filter name=general-deterrence-staging
curl -fsS http://127.0.0.1:3100/api/health
curl -fsS http://127.0.0.1:3100/api/leaderboard
```

After adding the Caddy route and DNS:

```bash
curl -I https://gd.esponet.me
curl -fsS https://gd.esponet.me/api/health
curl -I https://game.esponet.me
curl -fsS https://game.esponet.me/api/health
```

Check the existing services still respond:

```bash
curl -I https://adguard.esponet.me
curl -I https://monitor.esponet.me
curl -I https://ntfy.esponet.me
```

## Rollback

Game-only rollback:

```bash
docker stop general-deterrence-staging
docker rm general-deterrence-staging
```

Remove only the game Caddy block and reload Caddy. Do not edit existing
AdGuard, monitor, sync, or ntfy blocks.

The SQLite leaderboard data lives under:

```bash
/opt/general-deterrence/data
```

Do not delete that directory unless explicitly asked.
