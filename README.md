# DMI Weather Sync

Syncs weather data from the Danish Meteorological Institute (DMI) API to Windguru.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your credentials
npm start
```

## Configuration

Required environment variables in `.env`:

```env
DMI_STATION_ID=your_station_id
WINDGURU_STATION_UID=your_station_uid
WINDGURU_STATION_PASSWORD=your_station_password
```

Get credentials:
- Windguru station: [https://stations.windguru.cz/](https://stations.windguru.cz/)
- DMI Station IDs: [DMI Open Data Docs](https://opendatadocs.dmi.govcloud.dk/Data/Meteorological_Observation_Data_Stations)

## Weather Data

Syncs temperature, wind speed/direction/gusts/min, humidity, and pressure. Automatically converts wind speeds from m/s to knots.

## Commands

```bash
npm start          # Run the service
npm run dev        # Development mode with auto-reload
npm test           # Run tests
npm run build      # Build TypeScript
npm run lint       # Check code quality
```

## Docker

```bash
# Build image
docker build -t dmi-weather-sync .

# Run container
docker run -d --name dmi-sync --env-file .env dmi-weather-sync
```

## How It Works

1. Polls DMI API for latest 10-minute observations
2. Transforms GeoJSON response to internal format
3. Converts units (m/s → knots)
4. Uploads to Windguru (MD5 authenticated HTTP GET)

## License

MIT
