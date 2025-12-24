# Noridoc: dmi-weather-sync

Path: @/

### Overview

- Daemon service that syncs weather data from DMI (Danish Meteorological Institute) to Windguru
- Supports multiple weather stations with independent sync state per station
- Uses TOML configuration for station mappings and environment variables for secrets

### Configuration Architecture

```
┌──────────────────┐     ┌────────────────────┐
│  stations.toml   │     │       .env         │
│                  │     │                    │
│ ["Station Name"] │     │ WINDGURU_PASSWORD_ │
│ dmi_station_id   │     │ {STATION_NAME}=... │
│ windguru_uid     │     │                    │
└────────┬─────────┘     └─────────┬──────────┘
         │                         │
         └───────────┬─────────────┘
                     ▼
              Config Loading
              (at startup)
                     │
                     ▼
              SyncService
```

- **Station definitions**: `stations.toml` maps human-readable station names to DMI station IDs and Windguru UIDs
- **Password storage**: Environment variables follow naming convention `WINDGURU_PASSWORD_{SANITIZED_NAME}`
- **Sanitization rule**: Station name converted to uppercase, non-alphanumeric characters replaced with underscores, consecutive underscores collapsed

### Core Implementation

- **Entry point**: `src/index.ts` loads config and starts the sync service
- **Sync timing**: Runs every 5 minutes at :01, :06, :11, etc. (offset by 1 minute to allow DMI data to be available)
- **Parallel fetch, sequential push**: DMI stations are fetched in parallel; Windguru pushes happen sequentially per station
- **Fault isolation**: `Promise.allSettled()` ensures one station failure does not block others

### Things to Know

- **Breaking change**: Previous versions used `DMI_STATION_ID`, `WINDGURU_STATION_UID`, `WINDGURU_STATION_PASSWORD` environment variables - these no longer work
- **Config file required**: Service will not start without `stations.toml` - copy from `stations.toml.example`
- **Docker deployment**: Mount `stations.toml` into container and pass password env vars via `--env-file`

Created and maintained by Nori.
