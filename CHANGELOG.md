# Changelog

All notable changes to this fork are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project currently uses a continuously deployed `main` branch and has not started publishing semantic-version tags.

## Unreleased

### Added

- MongoDB-backed private-server global progress for live Goals, isolated by official ID and activation cycle.
- Atomic local `Count`, `HealthPct`, `Success`, and completion updates driven by mission contributions.
- Restart recovery and delayed cleanup for live Goal and invasion state.
- Live-aware Goal lookup for personal rewards and mission cache rewards.
- GitHub Container Registry publication for `linux/amd64` and `linux/arm64` images.
- Full Docker Compose stack with SpaceNinjaServer, MongoDB, the upstream IRC image, and the upstream Hub image.

### Changed

- Official live Goal progress fields no longer overwrite private-server global progress.
- SpaceNinjaServer Docker images are published as `ghcr.io/specia1z/spaceninjaserver:latest` and immutable commit-SHA tags.
- Docker builds use GitHub Actions cache and authenticate with the repository `GITHUB_TOKEN` instead of a Docker Hub secret.
- Local Docker builds exclude server configuration, databases, logs, build output, and other runtime data from the image context.

## 0.1.0 - 2026-09-23

### Added

- Independent repository history for the Specia1z SpaceNinjaServer fork.
- Compatibility work focused on the Warframe 42.0.11 client family.
- Live synchronization for supported world-state definitions, vendors, missions, Nightwave, calendar seasons, and Descents.
- MongoDB-backed local invasion progress and restart recovery.
- Account initialization, mission progression, starter rewards, configurable mission Platinum rewards, and administrator controls.
- English and Simplified Chinese deployment documentation with project attribution, licensing information, and disclaimers.

### Security

- Local configuration, databases, logs, dependencies, and generated build output remain excluded from Git.
