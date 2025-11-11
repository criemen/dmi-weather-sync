import { DmiClient } from './services/dmi-client.js';
import { WindguruClient } from './services/windguru-client.js';

/**
 * Service that continuously syncs weather data from DMI to Windguru
 */
export class SyncService {
  private readonly dmiClient: DmiClient;
  private readonly windguruClient: WindguruClient;
  private intervalId?: NodeJS.Timeout;
  private isRunning = false;
  private lastSyncedTimestamp?: Date;

  constructor() {
    this.dmiClient = new DmiClient();
    this.windguruClient = new WindguruClient();
  }

  /**
   * Start the sync service
   */
  start(): void {
    if (this.isRunning) {
      console.log('Sync service is already running');
      return;
    }

    console.log('Starting sync service...');
    this.isRunning = true;

    // Perform initial sync immediately
    console.log('Performing initial sync...');
    void this.syncWeatherData();

    const { delayMs, targetTime } = this.calculateDelayUntilNextSync();

    console.log(
      `Next sync in ${Math.round(delayMs / 1000)}s at ${targetTime.getHours()}:${String(targetTime.getMinutes()).padStart(2, '0')}`
    );

    // Schedule first sync at the target time
    setTimeout(() => {
      void this.syncWeatherData();

      // Then schedule periodic syncs every 5 minutes
      this.intervalId = setInterval(
        () => {
          void this.syncWeatherData();
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
   * Perform a single sync operation
   */
  private async syncWeatherData(): Promise<void> {
    const timestamp = new Date().toISOString();

    try {
      console.log(`[${timestamp}] Starting weather data sync...`);

      // Fetch data from DMI
      let weatherData;
      try {
        weatherData = await this.dmiClient.fetchWeatherData();
        console.log('Weather data fetched:', weatherData);
      } catch (dmiError) {
        console.error(
          `[${timestamp}] Failed to fetch data from DMI, skipping this iteration:`,
          dmiError
        );
        return;
      }

      // Check if this data is newer than the last synced data
      if (
        this.lastSyncedTimestamp &&
        weatherData.timestamp <= this.lastSyncedTimestamp
      ) {
        console.log(
          `[${timestamp}] No new data available (last synced: ${this.lastSyncedTimestamp.toISOString()}), skipping Windguru push`
        );
        return;
      }

      // Push to Windguru
      try {
        await this.windguruClient.pushWeatherData(weatherData);
      } catch (windguruError) {
        console.error(
          `[${timestamp}] Failed to push data to Windguru:`,
          windguruError
        );
        return;
      }

      // Update last synced timestamp only after successful push
      this.lastSyncedTimestamp = weatherData.timestamp;

      console.log(
        `[${timestamp}] Weather data sync completed successfully (timestamp: ${weatherData.timestamp.toISOString()})`
      );
    } catch (error) {
      console.error(
        `[${timestamp}] Unexpected error during weather data sync:`,
        error
      );
      // Continue running despite errors
    }
  }
}
