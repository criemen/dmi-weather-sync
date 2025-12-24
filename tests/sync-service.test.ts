import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncService } from '../src/sync-service.js';
import type { StationsConfig } from '../src/types.js';

describe('SyncService - Multi-Station', () => {
  const mockStationsConfig: StationsConfig = {
    'Copenhagen Harbor': {
      dmiStationId: '06180',
      windguruUid: 'uid_copenhagen',
    },
    'Aarhus Beach': {
      dmiStationId: '06070',
      windguruUid: 'uid_aarhus',
    },
  };

  // Track fetch calls for verification
  let fetchCalls: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    fetchCalls = [];

    // Set up password env vars
    process.env.WINDGURU_PASSWORD_COPENHAGEN_HARBOR = 'pass_copenhagen';
    process.env.WINDGURU_PASSWORD_AARHUS_BEACH = 'pass_aarhus';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.WINDGURU_PASSWORD_COPENHAGEN_HARBOR;
    delete process.env.WINDGURU_PASSWORD_AARHUS_BEACH;
  });

  // Helper to create mock DMI response
  function createDmiResponse(windSpeed: number, timestamp: string) {
    return JSON.stringify({
      features: [
        {
          properties: {
            parameterId: 'wind_speed',
            value: windSpeed,
            observed: timestamp,
          },
        },
      ],
    });
  }

  // Smart mock that responds based on URL
  function setupSmartMock(options: {
    dmiResponses?: Map<string, string | Error>;
    windguruResponses?: Map<string, string | Error>;
    defaultDmiTimestamp?: string;
  }) {
    const dmiResponses =
      options.dmiResponses ??
      new Map([
        ['06180', createDmiResponse(5.0, options.defaultDmiTimestamp ?? '2024-01-01T10:00:00Z')],
        ['06070', createDmiResponse(6.0, options.defaultDmiTimestamp ?? '2024-01-01T10:00:00Z')],
      ]);

    const windguruResponses =
      options.windguruResponses ??
      new Map([
        ['uid_copenhagen', 'OK'],
        ['uid_aarhus', 'OK'],
      ]);

    vi.spyOn(global, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = url.toString();
      fetchCalls.push(urlStr);

      if (urlStr.includes('opendataapi.dmi.dk')) {
        // Extract stationId from URL
        const match = urlStr.match(/stationId=(\d+)/);
        const stationId = match?.[1];

        if (stationId && dmiResponses.has(stationId)) {
          const response = dmiResponses.get(stationId)!;
          if (response instanceof Error) {
            throw response;
          }
          return new Response(response, { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      }

      if (urlStr.includes('windguru.cz')) {
        // Extract uid from URL
        const match = urlStr.match(/uid=([^&]+)/);
        const uid = match?.[1];

        if (uid && windguruResponses.has(uid)) {
          const response = windguruResponses.get(uid)!;
          if (response instanceof Error) {
            throw response;
          }
          return new Response(response, { status: 200 });
        }
        return new Response('Not found', { status: 404 });
      }

      return new Response('Unknown URL', { status: 500 });
    });
  }

  it('accepts stations config in constructor', () => {
    const service = new SyncService(mockStationsConfig);
    expect(service).toBeDefined();
  });

  it('syncs all configured stations', async () => {
    setupSmartMock({});

    const service = new SyncService(mockStationsConfig);
    await service.syncOnce();

    // Verify DMI calls for both stations
    const dmiCalls = fetchCalls.filter((url) => url.includes('opendataapi.dmi.dk'));
    expect(dmiCalls).toHaveLength(2);
    expect(dmiCalls.some((url) => url.includes('stationId=06180'))).toBe(true);
    expect(dmiCalls.some((url) => url.includes('stationId=06070'))).toBe(true);

    // Verify Windguru calls for both stations
    const windguruCalls = fetchCalls.filter((url) => url.includes('windguru.cz'));
    expect(windguruCalls).toHaveLength(2);
    expect(windguruCalls.some((url) => url.includes('uid=uid_copenhagen'))).toBe(true);
    expect(windguruCalls.some((url) => url.includes('uid=uid_aarhus'))).toBe(true);
  });

  it('continues syncing other stations when one DMI fetch fails', async () => {
    setupSmartMock({
      dmiResponses: new Map([
        ['06180', new Error('Network error')], // Copenhagen fails
        ['06070', createDmiResponse(6.0, '2024-01-01T10:00:00Z')], // Aarhus succeeds
      ]),
    });

    const service = new SyncService(mockStationsConfig);

    // Should not throw
    await expect(service.syncOnce()).resolves.not.toThrow();

    // Aarhus should still have been synced to Windguru
    const windguruCalls = fetchCalls.filter((url) => url.includes('windguru.cz'));
    expect(windguruCalls).toHaveLength(1);
    expect(windguruCalls[0]).toContain('uid=uid_aarhus');
  });

  it('continues syncing other stations when one Windguru push fails', async () => {
    setupSmartMock({
      windguruResponses: new Map([
        ['uid_copenhagen', new Error('Auth error')], // Copenhagen push fails
        ['uid_aarhus', 'OK'], // Aarhus succeeds
      ]),
    });

    const service = new SyncService(mockStationsConfig);

    // Should not throw
    await expect(service.syncOnce()).resolves.not.toThrow();

    // Both DMI fetches should have happened
    const dmiCalls = fetchCalls.filter((url) => url.includes('opendataapi.dmi.dk'));
    expect(dmiCalls).toHaveLength(2);

    // Both Windguru pushes should have been attempted
    const windguruCalls = fetchCalls.filter((url) => url.includes('windguru.cz'));
    expect(windguruCalls).toHaveLength(2);
  });

  it('fetches stations in parallel', async () => {
    const callOrder: string[] = [];

    vi.spyOn(global, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = url.toString();

      if (urlStr.includes('opendataapi.dmi.dk')) {
        callOrder.push('dmi-start');
        // Simulate network delay
        await new Promise((r) => setTimeout(r, 50));
        callOrder.push('dmi-end');
        return new Response(createDmiResponse(5.0, '2024-01-01T10:00:00Z'), {
          status: 200,
        });
      } else {
        callOrder.push('windguru');
        return new Response('OK', { status: 200 });
      }
    });

    const service = new SyncService(mockStationsConfig);
    await service.syncOnce();

    // If parallel, we should see: dmi-start, dmi-start, dmi-end, dmi-end, windguru, windguru
    // If sequential, we would see: dmi-start, dmi-end, windguru, dmi-start, dmi-end, windguru
    const dmiStartIndices = callOrder
      .map((v, i) => (v === 'dmi-start' ? i : -1))
      .filter((i) => i >= 0);

    // Both dmi-starts should happen before any dmi-end (parallel execution)
    expect(dmiStartIndices[0]).toBeLessThan(2);
    expect(dmiStartIndices[1]).toBeLessThan(2);
  });

  it('maintains separate lastSyncedTimestamp per station', async () => {
    const timestamp1 = '2024-01-01T10:00:00Z';
    const timestamp2 = '2024-01-01T10:05:00Z';

    // First sync: both stations have different timestamps
    setupSmartMock({
      dmiResponses: new Map([
        ['06180', createDmiResponse(5.0, timestamp1)],
        ['06070', createDmiResponse(6.0, timestamp2)],
      ]),
    });

    const service = new SyncService(mockStationsConfig);
    await service.syncOnce();

    // Both should have pushed
    let windguruCalls = fetchCalls.filter((url) => url.includes('windguru.cz'));
    expect(windguruCalls).toHaveLength(2);

    // Reset for second sync
    fetchCalls = [];
    vi.restoreAllMocks();

    // Second sync: Copenhagen has same timestamp (no push), Aarhus has new timestamp
    setupSmartMock({
      dmiResponses: new Map([
        ['06180', createDmiResponse(5.0, timestamp1)], // Same timestamp - should skip
        ['06070', createDmiResponse(7.0, '2024-01-01T10:10:00Z')], // New timestamp - should push
      ]),
    });

    await service.syncOnce();

    // Only Aarhus should have pushed (Copenhagen skipped due to same timestamp)
    windguruCalls = fetchCalls.filter((url) => url.includes('windguru.cz'));
    expect(windguruCalls).toHaveLength(1);
    expect(windguruCalls[0]).toContain('uid=uid_aarhus');
  });

  it('throws error if station password is missing', () => {
    delete process.env.WINDGURU_PASSWORD_COPENHAGEN_HARBOR;

    expect(() => new SyncService(mockStationsConfig)).toThrow(
      /WINDGURU_PASSWORD_COPENHAGEN_HARBOR/
    );
  });
});
