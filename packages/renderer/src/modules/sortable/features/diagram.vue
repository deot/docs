<template>
	<div class="docs-renderer-features__diagram" aria-hidden="true">
		<svg viewBox="0 0 360 112">
			<g v-if="index % 3 === 0">
				<rect class="is-pale" x="12" y="12" width="336" height="88" rx="16" />
				<rect class="is-paper" x="40" y="22" width="60" height="74" rx="7" transform="rotate(-5 70 59)" />
				<rect class="is-paper" x="48" y="17" width="60" height="74" rx="7" />
				<rect class="is-ink" x="60" y="32" width="29" height="5" rx="2" />
				<path class="is-line" d="M60 48H94M60 57H94M60 66H82" />
				<path class="is-path" d="M116 54H246" />
				<rect class="is-signal" x="121" y="51" width="6" height="6" rx="2" />
				<rect class="is-paper" x="252" y="17" width="77" height="74" rx="8" />
				<path class="is-line" d="M252 34H329" />
				<circle class="is-ink" cx="261" cy="26" r="2" />
				<circle class="is-ink" cx="267" cy="26" r="2" />
				<rect class="is-ink" x="264" y="45" width="32" height="5" rx="2" />
				<path class="is-line" d="M264 60H316M264 69H305" />
			</g>
			<g v-else-if="index % 3 === 1">
				<rect class="is-pale" x="16" y="12" width="328" height="88" rx="16" />
				<rect class="is-paper" x="49" y="20" width="75" height="75" rx="8" />
				<rect class="is-paper" x="237" y="20" width="75" height="75" rx="8" />
				<path class="is-line" d="M64 37H104M64 49H110M64 61H98M253 37H294M253 49H298M253 61H282" />
				<path class="is-path" d="M134 41Q179 8 226 41M225 73Q180 106 135 73" />
				<circle class="is-ink" cx="181" cy="56" r="14" />
				<path class="is-line" d="M181 48V56L187 60" />
			</g>
			<g v-else>
				<rect class="is-pale" x="16" y="12" width="328" height="88" rx="16" />
				<path class="is-path" d="M73 56H155M204 56L274 28M204 56L274 84" />
				<circle class="is-paper" cx="181" cy="56" r="27" />
				<rect class="is-ink" x="171" y="46" width="20" height="20" rx="6" />
				<rect class="is-paper" x="42" y="40" width="32" height="32" rx="8" />
				<rect class="is-paper" x="274" y="12" width="32" height="32" rx="8" />
				<rect class="is-paper" x="274" y="68" width="32" height="32" rx="8" />
				<circle class="is-ink" cx="58" cy="56" r="5" />
				<circle class="is-ink" cx="290" cy="28" r="5" />
				<circle class="is-ink" cx="290" cy="84" r="5" />
			</g>
		</svg>
	</div>
</template>
<script setup lang="ts">
defineProps<{ index: number }>();
</script>
