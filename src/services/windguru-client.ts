import { createHash } from 'crypto';
import type { DmiWeatherData, WindguruPayload } from '../types.js';

/**
 * Client for pushing weather data to Windguru API
 * Uses HTTP GET with query parameters as per Windguru API spec
 */
export class WindguruClient {
  private readonly stationUid: string;
  private readonly stationPassword: string;
  private readonly stationName: string;
  private readonly baseUrl = 'http://www.windguru.cz/upload/api.php';

  constructor(
    stationUid: string,
    stationPassword: string,
    stationName: string
  ) {
    this.stationUid = stationUid;
    this.stationPassword = stationPassword;
    this.stationName = stationName;
  }

  /**
   * Push weather data to Windguru
   */
  async pushWeatherData(data: DmiWeatherData): Promise<void> {
    try {
      const payload = this.createPayload(data);
      const url = this.buildUrl(payload);

      console.log(`[${this.stationName}] Pushing weather data to Windguru...`);
      console.log(
        `[${this.stationName}] Request URL:`,
        url.replace(/hash=[^&]+/, 'hash=***')
      ); // Hide hash in logs

      const response = await fetch(url, {
        method: 'GET',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Windguru API error: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      const responseText = await response.text();
      console.log(`[${this.stationName}] Windguru API response:`, responseText);
      if (!responseText.includes('OK')) {
        throw new Error(`Windguru API returned error: ${responseText}`);
      }
      console.log(
        `[${this.stationName}] Weather data successfully pushed to Windguru`
      );
    } catch (error) {
      console.error(
        `[${this.stationName}] Error pushing data to Windguru:`,
        error
      );
      throw error;
    }
  }

  /**
   * Create Windguru payload from DMI weather data
   */
  private createPayload(data: DmiWeatherData): WindguruPayload {
    // Generate random salt (timestamp is commonly used)
    const salt = new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14);

    // Calculate MD5 hash: MD5(salt + uid + password)
    const hash = this.calculateHash(salt);

    const payload: WindguruPayload = {
      uid: this.stationUid,
      salt,
      hash,
    };

    // Add optional measurement data with unit conversions
    if (data.windSpeed !== undefined) {
      payload.wind_avg = this.mpsToKnots(data.windSpeed);
    }

    if (data.windGust !== undefined) {
      payload.wind_max = this.mpsToKnots(data.windGust);
    }

    if (data.windMin !== undefined) {
      payload.wind_min = this.mpsToKnots(data.windMin);
    }

    if (data.windDirection !== undefined) {
      payload.wind_direction = data.windDirection;
    }

    if (data.temperature !== undefined) {
      payload.temperature = data.temperature;
    }

    if (data.humidity !== undefined) {
      payload.rh = data.humidity;
    }

    if (data.pressure !== undefined) {
      payload.mslp = data.pressure;
    }

    // Set measurement interval to 10 minutes (600 seconds)
    payload.interval = 600;

    return payload;
  }

  /**
   * Calculate MD5 hash for authentication
   * Formula: MD5(salt + uid + password)
   */
  private calculateHash(salt: string): string {
    const data = salt + this.stationUid + this.stationPassword;
    return createHash('md5').update(data).digest('hex');
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(payload: WindguruPayload): string {
    const params = new URLSearchParams();

    // Add all non-undefined fields to query parameters
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, String(value));
      }
    });

    return `${this.baseUrl}?${params.toString()}`;
  }

  /**
   * Convert meters per second to knots
   * 1 m/s = 1.94384 knots
   */
  private mpsToKnots(mps: number): number {
    return parseFloat((mps * 1.94384).toFixed(2));
  }
}
