# PRD: DJ Set Builder

## Overview

A web app that helps DJs construct sets from their existing streaming platform playlists. The app lets DJs browse, filter, and select tracks from their library — organized by energy level and genre/mood tags — and arrange them into an ordered set with per-track musical metadata (BPM, key). Sets are saved to the app's own database and persist across sessions.

The app is designed for multi-platform support from the ground up: base playlists and song boxes can originate from different platforms (e.g. Spotify and SoundCloud), and every track in a set carries a platform source indicator.

---

## Problem

DJs manage large track libraries across multiple Spotify playlists. Building a set requires mentally cross-referencing energy levels, genre tags, BPM, and key — a process that is tedious and error-prone when done manually inside Spotify.

---

## Goals

- Let DJs filter their full library by energy level and one or more tag-based categories simultaneously (AND logic)
- Display BPM and key for every track
- Allow DJs to build, reorder, and save sets across sessions
- Stay in sync with source platforms — no separate song database
- Support multiple streaming platforms (Spotify in v1, SoundCloud and others in future versions)

---

## Non-Goals

- Automatic set generation or AI recommendations
- Audio playback inside the app
- Exporting sets back to Spotify/SoundCloud as playlists (v1)
- Multi-user collaboration

---

## Core Concepts

### Base Playlists
Playlists that together define the DJ's full library. Every song the DJ "owns" must appear in at least one base playlist. The canonical use case is energy-level playlists (e.g. playlists named `1` through `7`), but users are not required to follow that scheme.

- Base playlists are **platform-scoped**: a user designates base playlists separately per connected platform (e.g. Spotify base playlists and SoundCloud base playlists are independent sets)
- The user explicitly designates which of their playlists are base playlists during setup, and can update this at any time
- A song may appear in more than one base playlist within the same platform; deduplication is handled by the app
- Together, all base playlists across all platforms form the DJ's complete library

### Song Boxes
Playlists used as tag-based filters (e.g. `afrobeats`, `gqom`, `no lyrics`, `fast paced`). A song can belong to many song boxes.

- Song boxes are **platform-scoped**: a Spotify song box only matches Spotify tracks; a SoundCloud song box only matches SoundCloud tracks
- The user explicitly designates which of their playlists are song boxes during setup, and can update this at any time
- Song boxes do **not** define the library — they are purely for filtering
- Users can also filter by base playlists directly
- Because every song box is platform-scoped, selecting any song box filter implicitly scopes results to that platform — no special cross-platform handling needed

### Platform Source
Every track carries a `platform` field indicating its origin (e.g. `spotify`, `soundcloud`). This is displayed on track cards and set entries, and used to route API calls correctly.

---

## Core Algorithm

On session load (or on explicit refresh):

1. Fetch all tracks across all base playlists from each connected platform's API
2. Deduplicate into a hashmap keyed by a platform-namespaced track ID: `{ "spotify:<id>" → { track metadata, platform, playlists: [playlistId, ...] } }`
3. For each unique track, record every playlist (base or song box) it appears in
4. Batch-fetch audio features for all unique track IDs, grouped by platform (Spotify: `/audio-features` up to 100 IDs per request)
5. Store the resulting map in a short-lived client-side cache (TTL: ~20 minutes) to avoid redundant API calls within a session

**Filtering:** when the user selects one or more playlists as filters, return all tracks whose `playlists` array includes **all** selected playlist IDs (AND semantics).

---

## User Flows

### Onboarding / Setup
1. User registers with email and password
2. In user settings, user connects a streaming platform account — Spotify in v1 (SoundCloud and others in future versions)
3. From their connected playlists, user designates which are **base playlists** and which are **song boxes**
4. App builds the track hashmap and fetches audio features
5. User can return to settings at any time to update designations or connect additional platforms

### Building a Set
1. User opens the track browser
2. User optionally selects filter playlists (base and/or song boxes); results update in real time
3. User clicks a track to add it to the set; track card shows platform source badge
4. Set panel shows the ordered tracklist with BPM, key, and platform source per track
5. User drags tracks to reorder the set
6. Set is saved to the backend database automatically (or on explicit save)

### Managing Sets
- User can view, rename, and reopen previously saved sets
- Sets store track references (platform + track ID), not track data — metadata is re-fetched from the platform on open

### Refreshing Library
- User can manually trigger a library refresh to pull latest playlist state from connected platforms
- Cache is invalidated and the hashmap is rebuilt

---

## Track Card Data

Each track displays:
- Title, artist, album art
- BPM (from platform audio features)
- Musical key (from platform audio features)
- Platform source badge (e.g. Spotify, SoundCloud)
- Energy level label (derived from which base playlist it belongs to, if base playlists represent energy levels)

---

## Data Model (High-Level)

**User** — id, email, hashed password, createdAt

**PlatformConnection** — userId, platform (`spotify` | `soundcloud` | ...), OAuth tokens

**PlaylistDesignation** — userId, platform, platformPlaylistId, type (`base` | `song_box`)

**Set** — id, userId, name, createdAt, updatedAt

**SetTrack** — setId, position, platform, platformTrackId, snapshotMetadata (title, artist — for display if platform is unavailable)

---

## API Touchpoints

### Spotify (v1)

| Operation | Endpoint | Notes |
|---|---|---|
| Auth | OAuth 2.0 PKCE | Scopes: `playlist-read-private`, `playlist-read-collaborative` |
| List user playlists | `GET /me/playlists` | For setup/designation flow |
| Fetch playlist tracks | `GET /playlists/{id}/tracks` | Paginated, 100 tracks/page |
| Batch audio features | `GET /audio-features?ids=...` | Up to 100 IDs per request |

### SoundCloud (future)

| Operation | Notes |
|---|---|
| Auth | OAuth 2.0 |
| List playlists | To be mapped to designation flow |
| Fetch playlist tracks | To be mapped to hashmap build |
| Audio features (BPM/key) | SoundCloud does not expose BPM/key natively — fallback TBD |

---

## Tech Stack

### Frontend

| Layer | Technology |
|---|---|
| Framework | React + TypeScript |
| Styling | Tailwind CSS |
| Data fetching / server state | TanStack Query |
| Routing | TanStack Router |
| Forms | React Hook Form + Zod |
| Drag and drop | dnd-kit (`@dnd-kit/core`) |

### Backend

| Layer | Technology |
|---|---|
| Runtime | Node.js + Express + TypeScript |
| Database | MongoDB |
| ODM | Mongoose |
| Validation | Zod |
| Password hashing | bcrypt |
| JWT | jsonwebtoken |
| App auth | Email + password (JWT) |
| Platform auth | OAuth 2.0 PKCE per platform, proxied via Express (Spotify in v1) |

### Monorepo

| Layer | Technology |
|---|---|
| Structure | Turborepo monorepo |
| Packages | `apps/web`, `apps/api`, `packages/types` |
| Shared types | `packages/types` — single source of truth for TypeScript interfaces shared between frontend and backend |

**Notes:**
- TanStack Query handles platform API calls, caching (TTL ~20 min), and cache invalidation on manual refresh
- The Express backend handles OAuth token exchange, proxies authenticated platform API requests, and owns all persistence (sets, designations, connections)
- Track data is never stored in the DB — only references (platform + track ID) and a lightweight snapshot for display resilience
- Zod schemas in `packages/types` can be shared across `apps/web` and `apps/api` to keep validation consistent end-to-end

---

## Open Questions

1. What is the desired cache invalidation strategy — manual refresh only, or also on a background interval?
2. Should BPM/key mismatches between adjacent set tracks be flagged visually (harmonic mixing hints)?
3. For SoundCloud tracks without native BPM/key data, should the app allow manual entry or skip those fields?
