# Changelog

All notable changes to this fork are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and releases use semantic version tags.

## Unreleased

### Added

- Administrator item data synchronization: the latest public export tables and per-language dictionaries can be downloaded from browse.wf into `static/data/admin-item-data/`, versioned by game build so items newer than a client's build are filtered out rather than leaking into old clients.
- Store overrides for per-item listing state, discount percentage, and sale prices, applied to the world state and validated server-side at purchase time so a modified client cannot buy delisted or repriced items.
- Crafting policy configuration with a server-wide policy plus optional per-recipe overrides, covering stock/instant/custom build duration and an independent rush cost (stock, free, or a fixed Platinum price).
- Redemption codes with a standalone administrator management page: codes are stored in MongoDB, grant any item the server already understands via `uniqueName`, and support expiry, total-use limits, per-account limits, batch generation, custom length, and an optional prefix.
- Currencies can be granted alongside items anywhere the server already hands out rewards. Platinum, Credits, Endo, Dirac, Regal Aya, and free Platinum are addressed by field name rather than `uniqueName`, so they work in redemption codes, inbox attachments, and bundles. Negative counts subtract.
- A live, name-based item picker in the administrator WebUI. Item fields accept a localised name or a `/Lotus/...` path, and tables show the localised name with the unique name underneath. Currencies are offered by their localised names too.
- `missionPlatinumRewardChance` configuration option, a percentage rolled once per completed mission that decides whether the Platinum reward is granted at all.
- `missionPlatinumRewardSendMail` configuration option to deliver mission Platinum through an Ordis inbox message.
- A one-shot `deploy.sh` script that fetches the Compose file when the server was installed from the image alone, pre-creates the bind-mounted directories, and starts the stack.
- End-to-end verification scripts for in-game redemption, mission Platinum rewards, currency rewards, and the administrator item picker's search index.
- Settlement anti-cheat checks, configured under `antiCheat`. Only fields that reach the server through the mission settlement upload can be judged, so the checks cover the reward seed the client reports back, mission and alive time, the completions a single report claims, equipment XP relative to mission length, and basic validity and quantity limits for client-supplied inventory deltas. Every hit writes a `[anti-cheat]` warning naming the account and the offending values; detection is on by default and changes nothing else.
- The reward seed check accepts either seed the server actually issued, because a client legitimately holds two. The session's is fixed for the life of the session; the inventory's is refreshed by every `EndOfMatchUpload` and by `getNewRewardSeed`, and handed back in the settlement response. Since a session is reused across consecutive missions, the two diverge from the second mission onwards — so accepting only the session's seed flags every settlement after the first. The inventory seed also keeps the check working after the session document expires 5 minutes after its last update, which a long mission outlives.
- `antiCheat.enforce`, off by default. When enabled, a mismatched reward seed is replaced with the one the server issued for that session, and a report with an impossible mission time, excessive XP, or an invalid or oversized client inventory delta is dropped whole — including any credits or items it tried to carry.
- `antiCheat.minMissionTimeSec`, `antiCheat.maxMissionCompletesPerReport`, `antiCheat.maxXpPerMissionSecond`, and `antiCheat.maxClientItemCountPerReport` to tune the thresholds. The defaults (20 seconds, 10, 100000, and 10000) sit far above anything a legitimate report produces.
- An end-to-end verification script for the settlement anti-cheat checks, driving the real controller against a real MongoDB.
- An anti-cheat panel in the administrator WebUI, reachable from the sidebar. It lists the accounts that tripped a settlement check with a per-check count and the most recent timestamp, and loads an account's individual events, including the exact values the server judged, on demand. Recorded events are kept for 90 days.
- Ban and unban straight from that panel. A ban refuses the login and drops any live session immediately; unbanning restores access without touching the account's inventory or progress. Administrators can never be banned, so the operator cannot lock themselves out. Events can be cleared per account or wholesale, separately from the ban state.
- The same page exposes the detection thresholds and the enforce switch, so they can be tuned without hand-editing `config.json`. They are the six `antiCheat` values, read and written through the existing config controllers. Every page that renders config controls now shares one admin gate, which also fills the inputs — previously each page carried its own copy, and a page whose copy did not fill them showed blank fields.
- A `Banned` flag on the account. This is deliberately separate from `Dropped`, which only marks "your session ended" and is cleared on the next login.

### Changed

- Split new-account initialization into independent `autoCompleteQuestsForNewAccounts` and `unlockAllMissionsForNewAccounts` switches. Existing `autoCompleteQuestsAndUnlockMissions` values are migrated to both switches once.
- Mission Platinum rewards are credited straight to the balance by default instead of always being delivered as an Ordis inbox message.
- Store pricing resolves in three tiers: store override, then flash sale, then the base price. A discount percentage takes priority over an absolute override price and is applied to the unit price before multiplying by quantity.
- Redemption codes are normalized to uppercase, so players can type them in any case.
- Glyph code redemption is case-insensitive and now reports the acquisition to connected clients.
- Custom redemption codes are accepted at the in-game endpoint. The game client only posts codes to `/api/redeemPromoCode.php`, which previously only understood the hardcoded glyph codes.
- Flavour items whose entry is missing from the bundled public export data are stored by family path instead of being rejected.
- The Simplified Chinese WebUI translation is complete.
- Existing `config.json` files gain an `antiCheat` block on startup, so the new switches are visible without hand-editing.
- A single settlement report can no longer add more than `antiCheat.maxMissionCompletesPerReport` mission completions. The previous behaviour was unbounded, so a modified client could claim any number of runs at once.
- `MissionTime` and `AliveTime` are read from the settlement report. They were declared on the request type but never inspected, even though the controller's own checklist flagged them as unhandled.

### Fixed

- U44 network analysis stopped before sending NRS UDP probes because the login response omitted the `DTLS` setting for builds `43.5.0` and newer. The setting is now returned for all clients that support DTLS, so U43/U44 can initialize their NRS sockets.
- U44 IRC connections failed before authentication because the client only offers TLS 1.3 while the embedded IRC TLS server responds with TLS 1.2. Docker Compose now terminates IRC TLS 1.2/1.3 through HAProxy and bridges each secure port to its matching TLS 1.2 IRC port.
- Containers failed to start with `exec: "/app/docker-entrypoint.sh": permission denied`, because the checkout records the script without its executable bit and `COPY` preserves source permissions. Both the git mode and the `Dockerfile` now set it.
- Docker deployments installed from the image alone failed with `no configuration file provided`, because `docker pull` does not fetch the Compose file.
- Rush cost scaling divided by zero on instant recipes, producing a `NaN` Platinum price.
- The administrator item picker listed every translation string from `AdditionalDict` as if it were a grantable item, so searching `Platinum` offered `/Lotus/Language/Dojo/TradeTypePlatinum` — the Dojo trade-type label. Picking it could only ever fail. Language labels are now excluded from the search index.
- `/webui/admin-data`, `/webui/redeem-codes`, and `/webui/admin` answered 404 on a hard reload or when opened from a bookmark. The sidebar links worked because the client-side router intercepts them, but the routes were never registered on the server.
- Redeeming a custom code that granted anything other than a currency left the game stuck on its "please wait" modal, even though the items were granted and saved server-side. The response reported `FlavourItems` in the inventory's `{ ItemType }` shape, but this endpoint's client-side handler wants plain unique names — the shape the glyph path has always sent. Currencies were unaffected because they are plain numbers.

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
