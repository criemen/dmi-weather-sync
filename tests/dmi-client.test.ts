import { describe, it, expect } from 'vitest';
import { DmiClient } from '../src/services/dmi-client.js';

describe('DmiClient', () => {
  it('should fetch latest observations from DMI API', async () => {
    // This test requires valid DMI_API_KEY and DMI_STATION_ID in .env
    const client = new DmiClient();

    console.log('Fetching latest observations from DMI API...');
    const data = await client.fetchWeatherData();

    console.log('\n=== DMI Weather Data ===');
    console.log(JSON.stringify(data, null, 2));
    console.log('========================\n');

    // Verify the response structure
    expect(data).toBeDefined();
    expect(data.timestamp).toBeInstanceOf(Date);

    // Log individual fields for clarity
    console.log('Parsed fields:');
    console.log(`  Temperature: ${data.temperature ?? 'N/A'}°C`);
    console.log(`  Wind Speed: ${data.windSpeed ?? 'N/A'} m/s`);
    console.log(`  Wind Direction: ${data.windDirection ?? 'N/A'}°`);
    console.log(`  Wind Gust: ${data.windGust ?? 'N/A'} m/s`);
    console.log(`  Wind Min: ${data.windMin ?? 'N/A'} m/s`);
    console.log(`  Humidity: ${data.humidity ?? 'N/A'}%`);
    console.log(`  Pressure: ${data.pressure ?? 'N/A'} hPa`);
    console.log(`  Timestamp: ${data.timestamp.toISOString()}`);

    // At least timestamp should always be present
    expect(data.timestamp).toBeDefined();
  });
});
