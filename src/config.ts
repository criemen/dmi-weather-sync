import dotenv from 'dotenv';
import { readFileSync, existsSync } from 'fs';
import { parse as parseToml } from 'smol-toml';
import type { StationsConfig } from './types.js';

dotenv.config();

/**
 * Sanitize a station name to create a valid environment variable key
 * Converts to uppercase and replaces spaces/special chars with underscores
 */
export function sanitizeEnvKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_'); // Collapse multiple underscores
}

/**
 * Get password for a station from environment variable
 * Uses the sanitized station name as key: WINDGURU_PASSWORD_{NAME}
 */
export function getStationPassword(stationName: string): string {
  const envKey = `WINDGURU_PASSWORD_${sanitizeEnvKey(stationName)}`;
  const password = process.env[envKey];
  if (!password) {
    throw new Error(
      `Missing password for station '${stationName}'. ` +
        `Set environment variable: ${envKey}`
    );
  }
  return password;
}

/**
 * Load stations configuration from TOML file
 * Expects format:
 * ["Station Name"]
 * dmi_station_id = "..."
 * windguru_uid = "..."
 */
export function loadStationsConfig(configPath: string): StationsConfig {
  if (!existsSync(configPath)) {
    throw new Error(
      `Stations config file not found: ${configPath}. ` +
        `Create it from stations.toml.example`
    );
  }

  const tomlContent = readFileSync(configPath, 'utf-8');

  // Parse TOML (smol-toml throws on invalid syntax)
  const parsed = parseToml(tomlContent) as Record<
    string,
    { dmi_station_id?: string; windguru_uid?: string }
  >;

  // Transform snake_case TOML keys to camelCase
  const stations: StationsConfig = {};

  for (const [name, config] of Object.entries(parsed)) {
    if (config.dmi_station_id && config.windguru_uid) {
      stations[name] = {
        dmiStationId: config.dmi_station_id,
        windguruUid: config.windguru_uid,
      };
    }
  }

  if (Object.keys(stations).length === 0) {
    throw new Error(
      'No stations configured in config file. Add at least one station.'
    );
  }

  return stations;
}
