import { describe, it, expect, vi, afterEach } from 'vitest';
import { WindguruClient } from '../src/services/windguru-client.js';

describe('WindguruClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('accepts uid and password as constructor parameters', () => {
    const client = new WindguruClient(
      'test_uid',
      'test_password',
      'Test Station'
    );

    // Should not throw - credentials are passed directly
    expect(client).toBeDefined();
  });

  it('uses provided uid in request URL', async () => {
    const client = new WindguruClient(
      'my_station_uid',
      'my_password',
      'Test Station'
    );

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('OK', { status: 200 }));

    await client.pushWeatherData({
      timestamp: new Date('2024-01-01T10:00:00Z'),
      windSpeed: 5.0,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('uid=my_station_uid'),
      expect.anything()
    );
  });

  it('includes hash in request but not password', async () => {
    const client = new WindguruClient(
      'test_uid',
      'secret_password',
      'Test Station'
    );

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('OK', { status: 200 }));

    await client.pushWeatherData({
      timestamp: new Date('2024-01-01T10:00:00Z'),
      windSpeed: 5.0,
    });

    const callUrl = fetchSpy.mock.calls[0]![0] as string;

    // Should include hash
    expect(callUrl).toContain('hash=');
    // Should NOT include raw password
    expect(callUrl).not.toContain('secret_password');
  });

  it('converts wind speed from m/s to knots', async () => {
    const client = new WindguruClient(
      'test_uid',
      'test_password',
      'Test Station'
    );

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('OK', { status: 200 }));

    await client.pushWeatherData({
      timestamp: new Date('2024-01-01T10:00:00Z'),
      windSpeed: 10.0, // 10 m/s
    });

    const callUrl = fetchSpy.mock.calls[0]![0] as string;
    // 10 m/s * 1.94384 = 19.44 knots
    expect(callUrl).toContain('wind_avg=19.44');
  });

  it('includes all weather data fields in request', async () => {
    const client = new WindguruClient(
      'test_uid',
      'test_password',
      'Test Station'
    );

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('OK', { status: 200 }));

    await client.pushWeatherData({
      timestamp: new Date('2024-01-01T10:00:00Z'),
      windSpeed: 5.0,
      windGust: 8.0,
      windMin: 2.0,
      windDirection: 180,
      temperature: 15.5,
      humidity: 65,
      pressure: 1013.25,
    });

    const callUrl = fetchSpy.mock.calls[0]![0] as string;

    expect(callUrl).toContain('wind_avg=');
    expect(callUrl).toContain('wind_max=');
    expect(callUrl).toContain('wind_min=');
    expect(callUrl).toContain('wind_direction=180');
    expect(callUrl).toContain('temperature=15.5');
    expect(callUrl).toContain('rh=65');
    expect(callUrl).toContain('mslp=1013.25');
  });

  it('throws error when Windguru API returns error status', async () => {
    const client = new WindguruClient(
      'test_uid',
      'test_password',
      'Test Station'
    );

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('Authentication failed', {
        status: 401,
        statusText: 'Unauthorized',
      })
    );

    await expect(
      client.pushWeatherData({
        timestamp: new Date(),
        windSpeed: 5.0,
      })
    ).rejects.toThrow(/Windguru API error/);
  });
});
