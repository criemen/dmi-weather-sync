# Noridoc: services

Path: @/src/services

### Overview

- API clients for external weather services (DMI and Windguru)
- Each client is instantiated per-station with explicit configuration via constructor parameters
- Handles data transformation and authentication for their respective APIs

### How it fits into the larger codebase

- **Created by**: `SyncService` in `@/src/sync-service.ts` creates client instances during construction
- **Configuration source**: Clients receive their config from `SyncService`, which gets it from `@/src/config.ts`
- **Data flow**: `DmiClient.fetchWeatherData()` returns `DmiWeatherData`, which `SyncService` passes to `WindguruClient.pushWeatherData()`

### Core Implementation

#### DmiClient (`dmi-client.ts`)

- **Constructor**: `new DmiClient(stationId: string)` - takes DMI station ID
- **API endpoint**: `https://opendataapi.dmi.dk/v2/metObs/collections/observation/items` with query params for station, period (latest-10-minutes), and limit
- **Response parsing**: GeoJSON features contain parameter observations; client extracts latest value per parameter using a Map keyed by `parameterId`
- **Parameter mapping**: `temp_dry` -> temperature, `wind_speed` -> windSpeed, `wind_dir` -> windDirection, `wind_max` -> windGust, `wind_min` -> windMin, `humidity` -> humidity, `pressure_at_sea` -> pressure

#### WindguruClient (`windguru-client.ts`)

- **Constructor**: `new WindguruClient(stationUid: string, stationPassword: string)` - takes Windguru UID and password
- **Authentication**: MD5 hash of `salt + uid + password` where salt is timestamp stripped of non-digits
- **API method**: HTTP GET with query parameters (not POST with body)
- **Unit conversion**: Wind speeds converted from m/s to knots using factor 1.94384
- **Interval field**: Set to 600 seconds (10 minutes) to match DMI observation period

### Things to Know

- **No global config import**: Clients do not import from `@/src/config.ts` - they receive all config via constructor (dependency injection pattern)
- **Windguru uses GET, not POST**: Despite being an upload, Windguru API expects all data as URL query parameters
- **Password not logged**: `pushWeatherData()` redacts the hash when logging the request URL

Created and maintained by Nori.
