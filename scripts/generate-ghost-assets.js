/**
 * Ghost Asset Generator Script
 * 
 * This standalone script can be used to manually generate all ghost assets.
 * It imports the generateAllGhostAssets function from the Vite plugin.
 */

import { generateAllGhostAssets } from '../vite-plugins/ghost-asset-generator.js';

// Run the asset generation
console.log('🧩 Starting ghost asset generation...');
generateAllGhostAssets()
  .then(() => {
    console.log('✅ Ghost asset generation completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error during ghost asset generation:', err);
    process.exit(1);
  });