# SpaceNinjaServer

[English](README.md) | [简体中文](README.zh-CN.md)

An independent second-development fork of [OpenWF SpaceNinjaServer](https://onlyg.it/OpenWF/SpaceNinjaServer), maintained by [Specia1z](https://github.com/Specia1z). It provides a self-hosted implementation of the web services used by Warframe clients and is intended for private servers, testing, preservation, and development.

This fork keeps the upstream project and its attribution while maintaining its own development history and release direction. It is not affiliated with or endorsed by Digital Extremes.

## Current Focus

- Compatibility work for the 42.0.11 client family.
- Live world-state synchronization from public Warframe world-state sources.
- Local MongoDB-backed global Goal and invasion progress, including restart recovery and delayed cleanup of completed activities.
- Synchronized alerts, goals, fissures, sorties, Void Storms, Conquests, Baro, Darvo, Varzia, Teshin, syndicate missions, Nightwave, calendar seasons, and Duviri/Descents data.
- Prime Vault manifest and purchase compatibility for supported legacy clients.
- Optional account initialization, mission completion, starter-pack, mastery cooldown, and administrator controls.
- A browser-based WebUI for account administration and server configuration.

## Requirements

- Node.js 24 or newer.
- MongoDB 7 or newer, or the embedded MongoDB configuration supplied by `config-vanilla.json`.
- A client build compatible with the server data and configured build mapping.

## Quick Start

```powershell
npm ci
Copy-Item config-vanilla.json config.json
npm run verify
npm run dev
```

The default configuration listens on HTTP port `80` and enables the WebUI for administrators. Change `myAddress`, ports, administrator names, and WebUI permissions before exposing the server to a network.

For a production-style build:

```powershell
npm ci --omit=dev
npm run build
npm start
```

The server can also be run with Docker Compose. The included compose file starts SpaceNinjaServer together with MongoDB, a locally patched OpenWF IRC build, and the upstream Hub image. Configuration, logs, static data, and database files are stored under `docker-data/`.

`warframe-public-export-plus` is bundled with the installation and Docker image, so the server can start without network access. `npm start`, `npm run dev`, `npm run raw`, and the self-contained release launchers check the official npm registry before loading server modules. By default they only report a newer version. Set `PUBLIC_EXPORT_AUTO_UPDATE=1` to download a compatible update in the same `0.6.x` series, verify its registry SHA-512 integrity and archive paths, and atomically replace only that package. A failed check or update falls back to the bundled snapshot. Cross-minor or major versions require a SpaceNinjaServer upgrade. Set `PUBLIC_EXPORT_CHECK_UPDATES=0` for fully offline startup. Slow links can override the default 120-second package download timeout with `PUBLIC_EXPORT_DOWNLOAD_TIMEOUT_MS`. Manual commands are also available: `npm run check-public-export` and `npm run update-public-export`.

## Docker

Images for this fork are published to `ghcr.io/specia1z/spaceninjaserver` for `linux/amd64` and `linux/arm64`. The `latest` tag tracks `main`, while every build also receives an immutable commit-SHA tag.

On a server that has only pulled the image, there is nothing for `docker compose up` to read yet: the compose file ships in this repository, not inside the image. Use the deploy script to fetch it and create the data directories in one step.

```bash
mkdir -p /opt/spaceninjaserver && cd /opt/spaceninjaserver
curl -fsSL https://raw.githubusercontent.com/Specia1z/SpaceNinjaServer/main/deploy.sh | bash
```

When the repository is already checked out, the same script uses the local compose file and is equivalent to:

```bash
docker compose pull
docker compose up -d --build
```

To build the checked-out source instead of using the published Web image:

```bash
docker compose up -d --build
```

Compose runs only SpaceNinjaServer and the official MongoDB image. The built-in TLS IRC service runs inside the SpaceNinjaServer container on ports `6695-6699`, allowing both TLS 1.2 and TLS 1.3 clients to connect. Hub and NRS are external services and are not managed by this compose file. The first launch creates `docker-data/conf/config.json` automatically.

Administrators can submit red IRC announcements for all currently connected players from **WebUI → Users → Global IRC Announcement**. When built-in IRC is enabled, announcements are broadcast directly inside the SpaceNinjaServer process and no management port is required. When using an external IRC server instead, configure its management endpoint with `ircManagementUrl`; do not expose that endpoint publicly.

The default compose file publishes UDP port `6953` for the protocol-opaque Hub relay. Keep it when `udpRelayPort` is enabled and points at a reachable bare-metal Hub through `udpRelayTarget`; remove the mapping when clients connect directly to the Hub. Bare-metal NRS ports, including its DTLS listener and optional relay pool, must be opened on the host firewall separately.

## Releases

GitHub Releases provide self-contained archives for Windows x64, Linux x64/ARM64, and macOS x64/ARM64. Each archive includes the compiled server, production dependencies, and the matching Node.js runtime. Extract the archive and run `start.cmd` on Windows or `./start.sh` on Linux and macOS. The launcher creates `config.json` from the vanilla template on first use.

Download `SHA256SUMS.txt` from the same release to verify an archive before running it. MongoDB remains configurable: the vanilla configuration starts a local embedded instance, while production deployments can use an external MongoDB connection string.

## Configuration

Copy `config-vanilla.json` to `config.json` before the first launch. `config.json` is intentionally ignored by Git because it commonly contains local addresses, administrator names, certificates, and deployment-specific settings.

Important settings include:

- `database`: use the embedded MongoDB object or a MongoDB connection string such as `mongodb://127.0.0.1:27017/openWF`.
- `myAddress`, `bindAddress`, `httpPort`, and `httpsPort`: control how clients reach the server. Container ports are controlled by `docker-compose.yml`.
- `builtinIrcEnabled` and `builtinIrcPorts`: run the built-in TLS IRC service after HTTP startup, using the configured HTTPS certificate and key. It validates U44 IRC credentials through the local `/custom/getAccountInfo` endpoint. Leave it disabled when using `ircExecutable` or another IRC server.
- `udpRelayPort` and `udpRelayTarget`: enable the protocol-opaque UDP relay used for Hub/dojo traffic. The relay listens on `udpRelayPort` and forwards unchanged datagrams to the Hub at `udpRelayTarget`; expose the relay UDP port in the firewall and Docker configuration. Set `udpRelayPortPoolSize` above `1` to map consecutive relay ports to consecutive target ports.
- `hubServers`: the Hub service itself must be running and reachable on its configured UDP address, usually port `6952`. An optional `portPoolSize` assigns authenticated accounts stable ports starting at the configured address. The relay is only a transport layer and does not replace the Hub server.
- `administratorNames`: accounts allowed to use administrator features.
- `registrationRateLimit`: game auto-registration and WebUI signups share a rolling 24-hour quota (default: three attempts per client address, 100 account creations server-wide, and 1000 attempts including failed writes). Configure `windowMinutes`, `perAddress`, `global`, and `globalAttempts` in `config.json` (Docker: `docker-data/conf/config.json`). Existing-account logins are unaffected. Client-supplied `X-Forwarded-For` is ignored unless the connecting reverse proxy's exact IP is listed in `trustedProxies`; without that setting, users behind one proxy share a quota. Counters are process-local and reset on restart; multiple replicas need a shared store, and distributed abuse requires invitations or identity verification.
- `accountDropMultipliers`: configure per-account resource pickup amount and mission Mod multipliers, keyed by the exact in-game display name. For example:

  ```json
  {
    "accountDropMultipliers": {
      "ExampleAccount": {
        "resourceMultiplier": 5,
        "modMultiplier": 10
      }
    }
  }
  ```

  Unconfigured accounts keep the normal behavior. Modern clients (39.1+) receive a signed, account-scoped world state with a resource pickup amount bonus, independent of the shared global setting; re-login after changing the rate. Older clients instead receive a final-settlement resource fallback. Mod quantities from reported pickups, mission rewards, and server-rolled drops are scaled at settlement, not in the in-mission pickup display. These legacy resource/Mod settings do not change fixed mission resource rewards, blueprints, or credits; configure mission credits separately in the account rate profile.
- `accountRateProfiles`: account-ID-based multiplier profiles managed from the admin-only Account Rates WebUI page. The editor covers resource pickups, Mod quantities, mission credits, Warframe/weapon Affinity, separate Focus XP, syndicate and Nightwave standing, relic items and platinum, mission platinum, and daily tribute. Profiles support an optional expiry. Modern clients receive resource, credit, and Affinity boosts in signed account-scoped world state, compounded with global events; client-boosted cash pickups are not scaled again at settlement, while server-generated rewards still receive the account rate and any inventory Credit Booster. Older clients retain settlement fallbacks for resources and credits. Re-login after changing client-side rates. Existing display-name-based drop rates appear in the editor and are migrated to the ID-based profile when saved.
- `worldState.liveSync`: enables live world-state synchronization. The active fork configuration enables this by default; the vanilla template leaves it disabled.
- `worldState.eidolonOverride`: set to `day` or `night` to lock Plains of Eidolon or Cambion Drift time.
- `worldState.vallisOverride`: set to `warm` or `cold` to lock Orb Vallis temperature.
- `worldState.duviriOverride`: set to `joy`, `anger`, `envy`, `sorrow`, or `fear` to lock the Duviri spiral.
- `worldState.allTheFissures`: set to `normal` or `hard` to expose all supported fissures.
- `worldState.circuitGameModes`: provide an array to override the random Circuit rotation.

The WebUI can change supported configuration values for authorized administrators. Configuration changes are watched and applied without rebuilding the application.

## Development

Install dependencies and start the auto-reloading development server:

```powershell
npm ci
npm run dev
```

Useful checks before committing:

```powershell
npm run verify
npm run lint
npm exec prettier -- --check .
git diff --check
```

See [CHANGELOG.md](CHANGELOG.md) for fork changes and [CONTRIBUTING.md](CONTRIBUTING.md) for WebUI translation and contribution guidelines.

## Data Sources

When live synchronization is enabled, the server supplements its local compatibility data with public world-state data. The server filters unsupported nodes, rewards, rotations, and client-specific fields before returning the result to a client.

Live source availability is not required for persisted local activity progress to survive a restart. Official Goal and invasion definitions are treated as snapshots; their global progress and completion are maintained by this fork in MongoDB. The `Events` array contains announcements rather than gameplay progress and therefore remains definition-only.

## Attribution and License

This project is derived from the OpenWF SpaceNinjaServer project. See [LICENSE](LICENSE) for the applicable AGPLv3 license and Commons Clause condition. Source and project history from upstream remain acknowledged here for transparency.

## Disclaimer

This project is unofficial and is not affiliated with, authorized, sponsored, or endorsed by Digital Extremes Ltd. or Warframe. Names, trademarks, artwork, and game content remain the property of their respective owners.

The software is provided as-is, without warranties of availability, compatibility, security, data integrity, fitness for a particular purpose, or non-infringement. Users are solely responsible for obtaining any required authorization and for complying with applicable laws, software licenses, network-service terms, and the restrictions in [LICENSE](LICENSE). Do not use this project for unauthorized access, disruption of official services, circumvention of technical protections, infringement, or other unlawful activity.

Operators assume the risks associated with accounts, databases, network exposure, certificates, client files, third-party data sources, and backups. Do not commit credentials, private keys, production databases, or other sensitive information. This notice does not constitute legal advice and does not exclude liability that cannot lawfully be excluded. Obtain qualified legal advice before offering a public service, providing access to third parties, or processing real user data.
