<script>
	import '../app.css';
	import PwaInstallCard from '$lib/components/PwaInstallCard.svelte';

	let { children } = $props();
</script>

{@render children()}

<PwaInstallCard
	appName="ZipList"
	tagline="Talk it into a list. Tick it off."
	iconSrc="/icons/icon-192x192.png"
	storagePrefix="ziplist"
/>
