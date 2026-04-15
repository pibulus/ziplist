<script>
	export let progress = 0;
</script>

<div
	class="mx-auto h-[64px] w-[90%] min-w-[280px] max-w-[420px] overflow-hidden rounded-full bg-amber-200 shadow-md shadow-black/10 sm:w-[85%]"
	role="progressbar"
	aria-label="Transcription progress"
	aria-valuenow={progress}
	aria-valuemin="0"
	aria-valuemax="100"
>
	<div
		class="flex h-full items-center justify-center bg-gradient-to-r from-amber-400 to-rose-300 transition-all duration-300"
		style="width: {progress}%;"
	>
		<span class="relative z-10 font-bold text-white">Ziplisting...</span>
	</div>
</div>
