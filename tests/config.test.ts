import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import path from 'path';

// We'll import these after implementation
// import { loadStationsConfig, getStationPassword, sanitizeEnvKey } from '../src/config.js';

describe('Config - TOML Loading', () => {
  const testConfigPath = path.join(import.meta.dirname, 'test-stations.toml');

  afterEach(() => {
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
  });

  it('parses valid TOML with multiple stations using quoted section names', async () => {
    writeFileSync(
      testConfigPath,
      `
["Copenhagen Harbor"]
dmi_station_id = "06180"
windguru_uid = "uid_copenhagen"

["Aarhus Beach"]
dmi_station_id = "06070"
windguru_uid = "uid_aarhus"
`
    );

    // Import dynamically to avoid module-level config execution
    const { loadStationsConfig } = await import('../src/config.js');
    const config = loadStationsConfig(testConfigPath);

    // Should parse as Record<string, StationConfig>
    expect(Object.keys(config)).toHaveLength(2);
    expect(config['Copenhagen Harbor']).toBeDefined();
    expect(config['Copenhagen Harbor'].dmiStationId).toBe('06180');
    expect(config['Copenhagen Harbor'].windguruUid).toBe('uid_copenhagen');
    expect(config['Aarhus Beach']).toBeDefined();
    expect(config['Aarhus Beach'].dmiStationId).toBe('06070');
    expect(config['Aarhus Beach'].windguruUid).toBe('uid_aarhus');
  });

  it('throws descriptive error for missing config file', async () => {
    const { loadStationsConfig } = await import('../src/config.js');

    expect(() => loadStationsConfig('/nonexistent/path.toml')).toThrow(
      /config file not found/i
    );
  });

  it('throws on invalid TOML syntax', async () => {
    writeFileSync(testConfigPath, 'invalid [ toml {{');

    const { loadStationsConfig } = await import('../src/config.js');

    expect(() => loadStationsConfig(testConfigPath)).toThrow();
  });

  it('throws error for empty config (no stations)', async () => {
    writeFileSync(testConfigPath, '# Empty config file\n');

    const { loadStationsConfig } = await import('../src/config.js');

    expect(() => loadStationsConfig(testConfigPath)).toThrow(
      /no stations configured/i
    );
  });
});

describe('Config - Password Lookup', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clean up any test env vars
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('WINDGURU_PASSWORD_')) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  it('retrieves password from environment variable using sanitized station name', async () => {
    process.env.WINDGURU_PASSWORD_COPENHAGEN_HARBOR = 'secret123';

    const { getStationPassword } = await import('../src/config.js');
    const password = getStationPassword('Copenhagen Harbor');

    expect(password).toBe('secret123');
  });

  it('throws error when password env var not found', async () => {
    const { getStationPassword } = await import('../src/config.js');

    expect(() => getStationPassword('Unknown Station')).toThrow(
      /WINDGURU_PASSWORD_UNKNOWN_STATION/i
    );
  });
});

describe('Config - sanitizeEnvKey', () => {
  it('converts station name to valid env var key', async () => {
    const { sanitizeEnvKey } = await import('../src/config.js');

    expect(sanitizeEnvKey('Copenhagen Harbor')).toBe('COPENHAGEN_HARBOR');
    expect(sanitizeEnvKey('Aarhus Beach')).toBe('AARHUS_BEACH');
    expect(sanitizeEnvKey('station-with-dashes')).toBe('STATION_WITH_DASHES');
    expect(sanitizeEnvKey('MixedCase Name')).toBe('MIXEDCASE_NAME');
  });
});
