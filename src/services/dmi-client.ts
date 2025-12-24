import type { DmiWeatherData } from '../types.js';

/**
 * Client for fetching weather data from DMI API
 */
export class DmiClient {
  private readonly stationId: string;
  private readonly stationName: string;
  private readonly baseUrl = 'https://opendataapi.dmi.dk/v2';

  constructor(stationId: string, stationName: string) {
    this.stationId = stationId;
    this.stationName = stationName;
  }

  /**
   * Fetch current weather data from DMI
   */
  async fetchWeatherData(): Promise<DmiWeatherData> {
    try {
      console.log(`[${this.stationName}] Fetching weather data from DMI...`);

      const url = `${this.baseUrl}/metObs/collections/observation/items?stationId=${this.stationId}&period=latest-10-minutes&limit=50&sortorder=observed,DESC`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `DMI API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return this.transformDmiResponse(data);
    } catch (error) {
      console.error(
        `[${this.stationName}] Error fetching DMI weather data:`,
        error
      );
      throw error;
    }
  }

  /**
   * Transform DMI API response to our internal format
   */
  private transformDmiResponse(data: unknown): DmiWeatherData {
    // Validate response structure
    if (!this.isValidDmiResponse(data)) {
      throw new Error('Invalid DMI API response format');
    }

    const { features } = data;

    if (!features || features.length === 0) {
      // log data for debugging
      console.error(
        `[${this.stationName}] DMI API response has no features:`,
        JSON.stringify(data, null, 2)
      );
      throw new Error('No weather data available from DMI');
    }

    // Extract latest value for each parameter
    const latestByParam = new Map<
      string,
      { value: number; observed: string }
    >();

    for (const feature of features) {
      const { parameterId, value, observed } = feature.properties;
      if (!latestByParam.has(parameterId)) {
        latestByParam.set(parameterId, { value, observed });
      }
    }

    // Map DMI parameters to our data structure
    const result: DmiWeatherData = {
      temperature: latestByParam.get('temp_dry')?.value,
      windSpeed: latestByParam.get('wind_speed')?.value,
      windDirection: latestByParam.get('wind_dir')?.value,
      windGust: latestByParam.get('wind_max')?.value,
      windMin: latestByParam.get('wind_min')?.value,
      humidity: latestByParam.get('humidity')?.value,
      pressure: latestByParam.get('pressure_at_sea')?.value,
      timestamp: new Date(
        latestByParam.get('wind_speed')?.observed ||
          latestByParam.values().next().value?.observed ||
          new Date().toISOString()
      ),
    };

    return result;
  }

  /**
   * Type guard to validate DMI API response structure
   */
  private isValidDmiResponse(data: unknown): data is {
    features: Array<{
      properties: {
        parameterId: string;
        value: number;
        observed: string;
      };
    }>;
  } {
    return (
      typeof data === 'object' &&
      data !== null &&
      'features' in data &&
      Array.isArray((data as { features: unknown }).features)
    );
  }
}
