import dotenv from 'dotenv';

dotenv.config();

interface Config {
  dmi: {
    apiKey: string;
    stationId: string;
  };
  windguru: {
    stationUid: string;
    stationPassword: string;
  };
  polling: {
    intervalMs: number;
  };
}

function getEnvVar(key: string): string {
  const value: string | undefined = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config: Config = {
  dmi: {
    apiKey: getEnvVar('DMI_API_KEY'),
    stationId: getEnvVar('DMI_STATION_ID'),
  },
  windguru: {
    stationUid: getEnvVar('WINDGURU_STATION_UID'),
    stationPassword: getEnvVar('WINDGURU_STATION_PASSWORD'),
  },
  polling: {
    // Default to 5 minutes, configurable via env var (in seconds)
    intervalMs: process.env.POLLING_INTERVAL_SECONDS
      ? parseInt(process.env.POLLING_INTERVAL_SECONDS, 10) * 1000
      : 5 * 60 * 1000,
  },
};
