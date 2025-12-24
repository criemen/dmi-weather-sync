import path from 'path';
import { SyncService } from './sync-service.js';
import { loadStationsConfig } from './config.js';

/**
 * Main entry point for the DMI to Windguru weather sync service
 */
function main() {
  console.log('DMI Weather Sync Service');
  console.log('========================\n');

  // Load stations configuration from TOML
  const configPath = path.join(process.cwd(), 'stations.toml');

  let stationsConfig;
  try {
    stationsConfig = loadStationsConfig(configPath);
  } catch (error) {
    console.error('Failed to load stations configuration:', error);
    console.error('\nPlease create stations.toml from stations.toml.example');
    process.exit(1);
  }

  const stationNames = Object.keys(stationsConfig);
  console.log(`Loaded ${stationNames.length} station(s):`);
  for (const [name, config] of Object.entries(stationsConfig)) {
    console.log(
      `  - ${name}: DMI ${config.dmiStationId} -> Windguru ${config.windguruUid}`
    );
  }
  console.log();

  const syncService = new SyncService(stationsConfig);

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\nReceived shutdown signal...');
    syncService.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Start the service
  syncService.start();

  console.log('\nService is running. Press Ctrl+C to stop.\n');
}

main();
