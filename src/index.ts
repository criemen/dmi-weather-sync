import { SyncService } from './sync-service.js';

/**
 * Main entry point for the DMI to Windguru weather sync service
 */
function main() {
  console.log('DMI Weather Sync Service');
  console.log('========================\n');

  const syncService = new SyncService();

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
