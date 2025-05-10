import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import ghostAssetGenerator from './vite-plugins/ghost-asset-generator.js';

export default defineConfig({
	plugins: [
		sveltekit(),
		ghostAssetGenerator()
	]
});
