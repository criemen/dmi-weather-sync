# Noridoc: src

Path: @/src

### Overview

- Core application logic for syncing weather data from DMI (Danish Meteorological Institute) to Windguru
- Supports multiple weather stations with parallel fetching and fault isolation
- Configuration via TOML file with passwords in environment variables

### How it fits into the larger codebase

```
stations.toml     .env (passwords)
     │                 │
     └───────┬─────────┘
             ▼
     ┌───────────────┐
     │  index.ts     │  Entry point: loads config, starts service
     └───────┬───────┘
             │
             ▼
     ┌───────────────┐
     │ sync-service  │  Orchestrates multi-station sync
     └───────┬───────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌────────┐      ┌──────────┐
│  DMI   │      │ Windguru │
│ Client │      │  Client  │
└────────┘      └──────────┘
    │                 │
    ▼                 ▼
 DMI API         Windguru API
```

- **Entry point**: `index.ts` loads `stations.toml` via `config.ts`, then creates and starts `SyncService`
- **Config loading**: `config.ts` exports `loadStationsConfig()` for TOML parsing and `getStationPassword()` for password lookup
- **Dependency injection**: `SyncService` receives `StationsConfig` and creates per-station client instances
- **Type definitions**: `types.ts` defines `StationConfig`, `StationsConfig`, `DmiWeatherData`, and `WindguruPayload`

### Core Implementation

- **Configuration format**: TOML sections map station names to DMI/Windguru IDs. Passwords use convention `WINDGURU_PASSWORD_{STATION_NAME}` where station names are sanitized to uppercase with underscores
- **Per-station isolation**: Each station gets its own `DmiClient`, `WindguruClient`, and `lastSyncedTimestamp` - failures in one station do not affect others
- **Parallel DMI fetching**: `Promise.allSettled()` fetches all DMI stations simultaneously for efficiency
- **Sync timing**: Initial sync on startup, then syncs at minutes :01, :06, :11, etc. (every 5 minutes on the 1-minute offset)
- **Duplicate prevention**: Each station tracks `lastSyncedTimestamp` and skips push if DMI data timestamp is not newer

### Things to Know

- **Breaking change from legacy config**: Old `DMI_STATION_ID` / `WINDGURU_STATION_UID` environment variables no longer work - must use `stations.toml`
- **Password env key sanitization**: Station names like "Copenhagen Harbor" become `WINDGURU_PASSWORD_COPENHAGEN_HARBOR` via `sanitizeEnvKey()` in `config.ts`
- **Config loaded at runtime, not import time**: `loadStationsConfig()` must be explicitly called - this allows startup validation with helpful error messages rather than failing at module import
- **DMI API quirk**: Response is GeoJSON with multiple features per parameter - `dmi-client.ts` extracts latest value for each parameter ID

Created and maintained by Nori.
