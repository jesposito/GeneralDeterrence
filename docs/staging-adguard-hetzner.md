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

## DNS

`gd.esponet.me`, `generaldeterrence.esponet.me`, and `game.esponet.me` did not
resolve from the AdGuard host during inspection on 2026-05-04.

Existing `adguard.esponet.me` and `monitor.esponet.me` resolved through
Cloudflare anycast IPv6, so DNS for a new public hostname likely needs to be
created wherever `esponet.me` is managed.

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

