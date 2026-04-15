<script>
	// Shown when a local model (e.g. Whisper) is downloading
</script>

<div
	class="mx-auto flex h-[64px] w-[90%] min-w-[280px] max-w-[420px] items-center justify-center rounded-full bg-amber-100 shadow-md shadow-black/10 sm:w-[85%]"
	role="status"
	aria-label="Downloading model"
>
	<span class="flex items-center gap-2 text-lg font-bold text-amber-700">
		<svg class="h-5 w-5 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
			<path d="M12 4v12m0 0l-4-4m4 4l4-4" stroke-linecap="round" stroke-linejoin="round" />
			<path d="M4 18h16" stroke-linecap="round" />
		</svg>
		Downloading model...
	</span>
</div>
