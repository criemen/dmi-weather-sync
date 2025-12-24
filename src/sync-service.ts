import { DmiClient } from './services/dmi-client.js';
import { WindguruClient } from './services/windguru-client.js';
import { getStationPassword } from './config.js';
import type { StationsConfig } from './types.js';

/**
 * Context for a single station containing clients and state
 */
interface StationSyncContext {
  name: string;
  dmiClient: DmiClient;
  windguruClient: WindguruClient;
  lastSyncedTimestamp?: Date;
}

/**
 * Service that continuously syncs weather data from DMI to Windguru
 * Supports multiple stations with parallel fetching and fault isolation
 */
export class SyncService {
  private readonly stations: StationSyncContext[];
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;

  constructor(stationsConfig: StationsConfig) {
    this.stations = Object.entries(stationsConfig).map(([name, config]) => ({
      name,
      dmiClient: new DmiClient(config.dmiStationId, name),
      windguruClient: new WindguruClient(
        config.windguruUid,
        getStationPassword(name),
        name
      ),
      lastSyncedTimestamp: undefined,
    }));
  }

  /**
   * Start the sync service
   */
  start(): void {
    if (this.isRunning) {
      console.log('Sync service is already running');
      return;
    }

    console.log(
      `Starting sync service for ${this.stations.length} station(s)...`
    );
    this.stations.forEach((s) => console.log(`  - ${s.name}`));
    this.isRunning = true;

    // Perform initial sync immediately
    console.log('Performing initial sync...');
    void this.syncOnce();

    const { delayMs, targetTime } = this.calculateDelayUntilNextSync();

    console.log(
      `Next sync in ${Math.round(delayMs / 1000)}s at ${targetTime.getHours()}:${String(targetTime.getMinutes()).padStart(2, '0')}`
    );

    // Schedule first sync at the target time
    setTimeout(() => {
      void this.syncOnce();

      // Then schedule periodic syncs every 5 minutes
      this.intervalId = setInterval(
        () => {
          void this.syncOnce();
        },
        5 * 60 * 1000
      ); // 5 minutes
    }, delayMs);
  }

  /**
   * Calculate the delay in milliseconds until the next scheduled sync
   * Syncs occur at minutes 1, 6, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56
   */
  private calculateDelayUntilNextSync(): {
    delayMs: number;
    targetTime: Date;
  } {
    const now = new Date();
    const currentMinute = now.getMinutes();
    const currentSecond = now.getSeconds();
    const currentMillisecond = now.getMilliseconds();

    // Find next target minute (1, 6, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56)
    const targetMinutes = [1, 6, 11, 16, 21, 26, 31, 36, 41, 46, 51, 56];
    let nextTargetMinute = targetMinutes.find((m) => m > currentMinute);

    let minutesUntilNext: number;
    if (nextTargetMinute === undefined) {
      // If we're past minute 56, next target is minute 1 of next hour
      nextTargetMinute = targetMinutes[0]!;
      minutesUntilNext = 60 - currentMinute + nextTargetMinute;
    } else {
      minutesUntilNext = nextTargetMinute - currentMinute;
    }

    const delayMs =
      minutesUntilNext * 60 * 1000 - currentSecond * 1000 - currentMillisecond;

    // Calculate the actual target time
    const targetTime = new Date(now.getTime() + delayMs);

    return { delayMs, targetTime };
  }

  /**
   * Stop the sync service
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('Sync service is not running');
      return;
    }

    console.log('Stopping sync service...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Perform a single sync operation for all stations
   */
  async syncOnce(): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(
      `[${timestamp}] Starting sync for ${this.stations.length} station(s)...`
    );

    // Fetch from all DMI stations in parallel
    const fetchResults = await Promise.allSettled(
      this.stations.map(async (station) => {
        try {
          const data = await station.dmiClient.fetchWeatherData();
          return { station, data };
        } catch (error) {
          console.error(
            `[${timestamp}] Failed to fetch data for ${station.name}:`,
            error
          );
          throw error;
        }
      })
    );

    // Push to Windguru for successful fetches
    for (const result of fetchResults) {
      if (result.status === 'rejected') {
        continue; // Already logged error
      }

      const { station, data } = result.value;

      // Check if data is newer
      if (
        station.lastSyncedTimestamp &&
        data.timestamp <= station.lastSyncedTimestamp
      ) {
        console.log(
          `[${timestamp}] No new data for ${station.name}, skipping push`
        );
        continue;
      }

      try {
        await station.windguruClient.pushWeatherData(data);
        station.lastSyncedTimestamp = data.timestamp;
        console.log(`[${timestamp}] Successfully synced ${station.name}`);
      } catch (error) {
        console.error(
          `[${timestamp}] Failed to push data for ${station.name}:`,
          error
        );
      }
    }
  }
}
