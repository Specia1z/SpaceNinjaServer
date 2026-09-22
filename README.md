# SpaceNinjaServer

An independent second-development fork of [OpenWF SpaceNinjaServer](https://onlyg.it/OpenWF/SpaceNinjaServer), maintained by [Specia1z](https://github.com/Specia1z). It provides a self-hosted implementation of the web services used by Warframe clients and is intended for private servers, testing, preservation, and development.

This fork keeps the upstream project and its attribution while maintaining its own development history and release direction. It is not affiliated with or endorsed by Digital Extremes.

## Current Focus

- Compatibility work for the 42.0.11 client family.
- Live world-state synchronization from public Warframe world-state sources.
- Local MongoDB-backed invasion state, including signed faction progress, restart recovery, and delayed cleanup of completed invasions.
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

The server can also be run with Docker Compose. The included compose file starts SpaceNinjaServer together with MongoDB and stores configuration, logs, static data, and database files under `docker-data/`.

## Configuration

Copy `config-vanilla.json` to `config.json` before the first launch. `config.json` is intentionally ignored by Git because it commonly contains local addresses, administrator names, certificates, and deployment-specific settings.

Important settings include:

- `database`: use the embedded MongoDB object or a MongoDB connection string such as `mongodb://127.0.0.1:27017/openWF`.
- `myAddress`, `bindAddress`, `httpPort`, and `httpsPort`: control how clients reach the server. Container ports are controlled by `docker-compose.yml`.
- `administratorNames`: accounts allowed to use administrator features.
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

See [CONTRIBUTING.md](CONTRIBUTING.md) for WebUI translation and contribution guidelines.

## Data Sources

When live synchronization is enabled, the server supplements its local compatibility data with public world-state data. The server filters unsupported nodes, rewards, rotations, and client-specific fields before returning the result to a client.

Live source availability is not required for persisted local invasion progress to survive a restart. Official invasion definitions are treated as snapshots; global progress and completion are maintained by this fork in MongoDB.

## Attribution and License

This project is derived from the OpenWF SpaceNinjaServer project. See [LICENSE](LICENSE) for the applicable AGPLv3 license and Commons Clause condition. Source and project history from upstream remain acknowledged here for transparency.
