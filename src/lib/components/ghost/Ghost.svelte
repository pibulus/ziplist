<script>
	/** Lightweight ghost icon for use as a decorative element (e.g. copy button).
	 *  Accepts theme to tint the ghost fill color. */
	export let width = '100%';
	export let height = '100%';
	export let clickable = true;
	export let externalTheme = null;

	const themeColors = {
		peach: '#ffb6a3',
		mint: '#86efac',
		bubblegum: '#f0abfc',
		rainbow: '#c4b5fd',
		neo: '#fca5a5'
	};

	$: fillColor = themeColors[externalTheme] || themeColors.peach;
</script>

<svg
	{width}
	{height}
	viewBox="0 0 64 64"
	xmlns="http://www.w3.org/2000/svg"
	class="ghost-icon"
	class:clickable
	role={clickable ? 'button' : 'img'}
	aria-label="Ghost"
>
	<!-- Body -->
	<path
		d="M32 4C18.7 4 8 14.7 8 28v28c0 1.1.9 2 2 2 1.5 0 2.5-1.2 3.5-2.5C14.8 53.8 16.2 52 18 52s3.2 1.8 4.5 3.5c1 1.3 2 2.5 3.5 2.5s2.5-1.2 3.5-2.5C30.8 53.8 32.2 52 34 52s3.2 1.8 4.5 3.5c1 1.3 2 2.5 3.5 2.5s2.5-1.2 3.5-2.5C46.8 53.8 48.2 52 50 52s3.2 1.8 4.5 3.5c1 1.3 2 2.5 3.5 2.5 1.1 0 2-.9 2-2V28C60 14.7 49.3 4 32 4z"
		fill={fillColor}
		opacity="0.9"
	/>
	<!-- Eyes -->
	<circle cx="22" cy="28" r="4" fill="white" />
	<circle cx="42" cy="28" r="4" fill="white" />
	<circle cx="23" cy="28" r="2" fill="#333" />
	<circle cx="43" cy="28" r="2" fill="#333" />
</svg>

<style>
	.ghost-icon {
		display: block;
		transition: transform 0.2s ease;
	}
	.ghost-icon.clickable:hover {
		transform: scale(1.08);
	}
</style>
