/**
 * Weather data from DMI API
 */
export interface DmiWeatherData {
  temperature?: number;
  windSpeed?: number;
  windDirection?: number;
  windGust?: number;
  windMin?: number;
  humidity?: number;
  pressure?: number;
  timestamp: Date;
  // Add more fields based on actual DMI API response
}

/**
 * Weather data formatted for Windguru API
 * All wind speeds are in knots, temperature in Celsius, pressure in hPa
 */
export interface WindguruPayload {
  // Required for authentication
  uid: string;
  salt: string;
  hash: string;

  // Optional measurement data
  wind_avg?: number; // Average wind speed in knots
  wind_max?: number; // Maximum wind speed in knots
  wind_min?: number; // Minimum wind speed in knots
  wind_direction?: number; // Wind direction in degrees (0=N, 90=E, 180=S, 270=W)
  temperature?: number; // Temperature in Celsius
  rh?: number; // Relative humidity in percentage
  mslp?: number; // Mean sea level pressure in hPa
  precip?: number; // Precipitation in millimeters
  precip_interval?: number; // Precipitation interval in seconds (default: 3600)
  interval?: number; // Measurement interval in seconds
}
