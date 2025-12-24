import { describe, it, expect, vi, afterEach } from 'vitest';
import { DmiClient } from '../src/services/dmi-client.js';

describe('DmiClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts stationId as constructor parameter', () => {
    const client = new DmiClient('custom_station_123', 'Test Station');

    // Should not throw - stationId is passed directly
    expect(client).toBeDefined();
  });

  it('constructs URL with provided stationId', async () => {
    const client = new DmiClient('custom_station_456', 'Test Station');

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          features: [
            {
              properties: {
                parameterId: 'wind_speed',
                value: 5.0,
                observed: '2024-01-01T10:00:00Z',
              },
            },
          ],
        }),
        { status: 200 }
      )
    );

    await client.fetchWeatherData();

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('stationId=custom_station_456')
    );
  });

  it('fetches and transforms DMI response correctly', async () => {
    const client = new DmiClient('06180', 'Copenhagen Airport');

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          features: [
            {
              properties: {
                parameterId: 'wind_speed',
                value: 5.5,
                observed: '2024-01-01T10:00:00Z',
              },
            },
            {
              properties: {
                parameterId: 'wind_dir',
                value: 180,
                observed: '2024-01-01T10:00:00Z',
              },
            },
            {
              properties: {
                parameterId: 'temp_dry',
                value: 12.3,
                observed: '2024-01-01T10:00:00Z',
              },
            },
          ],
        }),
        { status: 200 }
      )
    );

    const data = await client.fetchWeatherData();

    expect(data.windSpeed).toBe(5.5);
    expect(data.windDirection).toBe(180);
    expect(data.temperature).toBe(12.3);
    expect(data.timestamp).toBeInstanceOf(Date);
  });

  it('throws error when DMI API returns error status', async () => {
    const client = new DmiClient('06180', 'Copenhagen Airport');

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      })
    );

    await expect(client.fetchWeatherData()).rejects.toThrow(/DMI API error/);
  });

  it('throws error when no weather data available', async () => {
    const client = new DmiClient('06180', 'Copenhagen Airport');

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ features: [] }), { status: 200 })
    );

    await expect(client.fetchWeatherData()).rejects.toThrow(
      /No weather data available/
    );
  });
});
