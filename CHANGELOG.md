# Changelog

All notable changes to this fork are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use semantic version tags.

## Unreleased

### Added

- Administrator item data synchronization: the latest public export tables and per-language dictionaries can be downloaded from browse.wf into `static/data/admin-item-data/`, versioned by game build so items newer than a client's build are filtered out rather than leaking into old clients.
- Store overrides for per-item listing state, discount percentage, and sale prices, applied to the world state and validated server-side at purchase time so a modified client cannot buy delisted or repriced items.
- Crafting policy configuration with a server-wide policy plus optional per-recipe overrides, covering stock/instant/custom build duration and an independent rush cost (stock, free, or a fixed Platinum price).
- Redemption codes with a standalone administrator management page: codes are stored in MongoDB, grant any item the server already understands via `uniqueName`, and support expiry, total-use limits, per-account limits, batch generation, custom length, and an optional prefix.
- A live, name-based item picker in the administrator WebUI. Item fields accept a localised name or a `/Lotus/...` path, and tables show the localised name with the unique name underneath.
- `missionPlatinumRewardChance` configuration option, a percentage rolled once per completed mission that decides whether the Platinum reward is granted at all.
- `missionPlatinumRewardSendMail` configuration option to deliver mission Platinum through an Ordis inbox message.
- A one-shot `deploy.sh` script that fetches the Compose file when the server was installed from the image alone, pre-creates the bind-mounted directories, and starts the stack.
- End-to-end verification scripts for in-game redemption and mission Platinum rewards.

### Changed

- Mission Platinum rewards are credited straight to the balance by default instead of always being delivered as an Ordis inbox message.
- Store pricing resolves in three tiers: store override, then flash sale, then the base price. A discount percentage takes priority over an absolute override price and is applied to the unit price before multiplying by quantity.
- Redemption codes are normalized to uppercase, so players can type them in any case.
- Glyph code redemption is case-insensitive and now reports the acquisition to connected clients.
- Custom redemption codes are accepted at the in-game endpoint. The game client only posts codes to `/api/redeemPromoCode.php`, which previously only understood the hardcoded glyph codes.
- Flavour items whose entry is missing from the bundled public export data are stored by family path instead of being rejected.
- The Simplified Chinese WebUI translation is complete.

### Fixed

- Containers failed to start with `exec: "/app/docker-entrypoint.sh": permission denied`, because the checkout records the script without its executable bit and `COPY` preserves source permissions. Both the git mode and the `Dockerfile` now set it.
- Docker deployments installed from the image alone failed with `no configuration file provided`, because `docker pull` does not fetch the Compose file.
- Rush cost scaling divided by zero on instant recipes, producing a `NaN` Platinum price.

### Security

- No longer documented real deployment paths in the README or deployment script.

## 0.1.0 - 2026-09-23

### Added

- Independent repository history for the Specia1z SpaceNinjaServer fork.
- Compatibility work focused on the Warframe 42.0.11 client family.
- Live synchronization for supported world-state definitions, vendors, missions, Nightwave, calendar seasons, and Descents.
- MongoDB-backed private-server global progress for live Goals, isolated by official ID and activation cycle.
- Atomic local `Count`, `HealthPct`, `Success`, and completion updates driven by mission contributions.
- Restart recovery and delayed cleanup for live Goal and invasion state.
- Live-aware Goal lookup for personal rewards and mission cache rewards.
- Account initialization, mission progression, starter rewards, configurable mission Platinum rewards, and administrator controls.
- English and Simplified Chinese deployment documentation with project attribution, licensing information, and disclaimers.
- GitHub Container Registry publication for `linux/amd64` and `linux/arm64` images.
- Versioned GitHub Container Registry tags matching each `v*` release tag.
- Full Docker Compose stack with SpaceNinjaServer, MongoDB, the upstream IRC image, and the upstream Hub image.
- Self-contained release archives for Windows x64, Linux x64/ARM64, and macOS x64/ARM64.

### Changed

- Official live Goal progress fields no longer overwrite private-server global progress.
- SpaceNinjaServer Docker images are published as `ghcr.io/specia1z/spaceninjaserver:latest` and immutable commit-SHA tags.
- Docker builds use GitHub Actions cache and authenticate with the repository `GITHUB_TOKEN` instead of a Docker Hub secret.
- Local Docker builds exclude server configuration, databases, logs, build output, and other runtime data from the image context.

### Security

- Local configuration, databases, logs, dependencies, and generated build output remain excluded from Git.
