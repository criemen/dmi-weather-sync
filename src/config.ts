import dotenv from 'dotenv';

dotenv.config();

interface Config {
  dmi: {
    stationId: string;
  };
  windguru: {
    stationUid: string;
    stationPassword: string;
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
    stationId: getEnvVar('DMI_STATION_ID'),
  },
  windguru: {
    stationUid: getEnvVar('WINDGURU_STATION_UID'),
    stationPassword: getEnvVar('WINDGURU_STATION_PASSWORD'),
  },
};
