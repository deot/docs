<template>
	<section ref="root" class="docs-renderer-code" :class="[`is-${align}`, { 'is-expanded': expanded }]" :style="style">
		<header v-if="value.eyebrow || value.title || value.description" class="docs-renderer-code__header" data-landing-reveal>
			<div v-if="value.eyebrow || value.title" class="docs-renderer-code__heading-row">
				<span v-if="value.eyebrow" class="docs-renderer-code__eyebrow">{{ value.eyebrow }}</span>
				<h2 v-if="value.title" class="docs-renderer-code__heading">{{ value.title }}</h2>
			</div>
			<p v-if="value.description" class="docs-renderer-code__lead">{{ value.description }}</p>
		</header>
		<div class="docs-renderer-code__window" data-landing-reveal>
			<div class="docs-renderer-code__bar">
				<span class="docs-renderer-code__file">
					<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">
						<path d="M5 2.5h6.5L16 7v10.5H5zM11.5 2.5V7H16M8 10.5l-2 2 2 2m4-4 2 2-2 2" />
					</svg>
					{{ value.filename }}
				</span>
				<span class="docs-renderer-code__language">
					{{ language ? `${language.toUpperCase()} · ` : '' }}{{ t('renderer.code.lines', { count: lines.length }) }}
				</span>
				<Clipboard
					class="docs-renderer-code__copy"
					:class="{ 'is-copied': copied }"
					tag="button"
					type="button"
					:value="content"
					:aria-label="t('renderer.code.copy')"
					@after="handleCopied"
				>
					<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">
						<rect x="7" y="7" width="9" height="10" rx="2" />
						<path d="M12 7V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h3" />
					</svg>
					<span aria-live="polite">{{ t(copied ? 'renderer.code.copied' : 'renderer.code.copyShort') }}</span>
				</Clipboard>
			</div>
			<Scroller
				ref="scroller"
				class="docs-renderer-code__scroller"
				max-height="var(--docs-renderer-code-height)"
				:native="false"
				:auto-resize="true"
				:show-bar="true"
				:thumb-style="{ background: 'color-mix(in srgb, var(--docs-renderer-accent) 23%, transparent)' }"
				tabindex="0"
				:aria-label="String(value.filename || language)"
			>
				<ol class="docs-renderer-code__lines">
					<li
						v-for="row in rows" :key="row.number" class="docs-renderer-code__line"
						:class="{ 'is-key': !row.fold && highlightLines.has(row.number) }"
					>
						<span class="docs-renderer-code__number" aria-hidden="true">{{ row.fold ? '…' : row.number }}</span>
						<button v-if="row.fold" class="docs-renderer-code__fold" type="button" :aria-expanded="false" @click="toggleExpanded">
							<span aria-hidden="true">›</span>{{ row.fold.label ? `${row.fold.label} · ` : '' }}
							{{ t('renderer.code.fold', { count: row.fold.count }) }}
						</button>
						<code v-else class="docs-renderer-code__source" v-html="row.html || ' '" />
					</li>
				</ol>
			</Scroller>
			<div class="docs-renderer-code__footer">
				<span class="docs-renderer-code__note">{{ t('renderer.code.copyNote', { count: lines.length }) }}</span>
				<button v-if="folds.length" class="docs-renderer-code__expand" type="button" :aria-expanded="expanded" @click="toggleExpanded">
					{{ t(expanded ? 'renderer.code.collapse' : 'renderer.code.expand') }}<span aria-hidden="true">↓</span>
				</button>
			</div>
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';
import { Clipboard, Scroller } from '@deot/vc';
import type { ScrollerExposed } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleViewerProps } from '../../../types';
import { toRecord } from '../../shared/utils';
import { highlightCodeLines } from '../../shared/code-highlight';
import { useLandingMotion } from '../../shared/landing-motion';

const props = defineProps<RendererModuleViewerProps>();
const { t } = useLocale(computed(() => props.context?.locale));
const root = useLandingMotion(() => props.context);
const scroller = ref<ScrollerExposed>();
const expanded = ref(false);
const copied = ref(false);
let copyTimer: ReturnType<typeof setTimeout> | undefined;
const value = computed(() => props.node.module.props);
const content = computed(() => String(value.value.content || ''));
const language = computed(() => String(value.value.language || ''));
const align = computed(() => String(value.value.align || 'center'));
const lines = computed(() => highlightCodeLines(content.value, language.value));
const highlightLines = computed(() => new Set(Array.isArray(value.value.highlightLines) ? value.value.highlightLines : []));
const folds = computed(() => {
	let end = 0;
	return (Array.isArray(value.value.folds) ? value.value.folds : []).map(toRecord)
		.map(fold => ({ start: Number(fold.start), end: Number(fold.end), label: String(fold.label || '') }))
		.sort((a, b) => a.start - b.start)
		.filter((fold) => {
			if (!Number.isInteger(fold.start) || !Number.isInteger(fold.end)
				|| fold.start <= end || fold.end < fold.start || fold.end > lines.value.length) return false;
			end = fold.end;
			return true;
		});
});
const rows = computed(() => {
	const result: { number: number; html: string; fold?: { label: string; count: number } }[] = [];
	const starts = new Map(folds.value.map(fold => [fold.start, fold]));
	for (let index = 0; index < lines.value.length; index++) {
		const fold = !expanded.value && starts.get(index + 1);
		result.push({
			number: index + 1, html: lines.value[index],
			...(fold ? { fold: { label: fold.label, count: fold.end - fold.start + 1 } } : {})
		});
		if (fold) index = fold.end - 1;
	}
	return result;
});
const style = computed(() => ({
	...(value.value.accent ? { '--docs-renderer-code-accent': String(value.value.accent) } : {}),
	...(value.value.background ? { '--docs-renderer-code-paper': String(value.value.background) } : {}),
	...(value.value.textColor ? { '--docs-renderer-ink': String(value.value.textColor) } : {})
}) as CSSProperties);
const toggleExpanded = async () => {
	expanded.value = !expanded.value;
	await nextTick();
	scroller.value?.setScrollTop(0);
};
const handleCopied = () => {
	copied.value = true;
	clearTimeout(copyTimer);
	copyTimer = setTimeout(() => { copied.value = false; }, 1800);
};
watch([content, () => value.value.folds], async () => {
	expanded.value = false;
	copied.value = false;
	clearTimeout(copyTimer);
	await nextTick();
	scroller.value?.setScrollTop(0);
}, { deep: true });
onBeforeUnmount(() => clearTimeout(copyTimer));
</script>
<style lang="scss">
@use '../../../../node_modules/@deot/docs-theme/src/functions' as *;
@use '../../shared/code-highlight' as highlight;
@use '../../shared/landing' as landing;

.docs-renderer-code {
	@include landing.section;
	@include highlight.colors;

	--docs-renderer-accent: light-dark(
		var(--docs-renderer-code-accent, #{varfix(color-primary)}),
		color-mix(in srgb, var(--docs-renderer-code-accent, #{varfix(color-primary)}) 35%, var(--docs-renderer-ink))
	);
	--docs-renderer-code-paper: light-dark(
		#{varfix(background-color)}, color-mix(in srgb, #{varfix(background-color)} 94%, var(--docs-renderer-ink))
	);
	--docs-renderer-muted: color-mix(in srgb, var(--docs-renderer-ink) 68%, var(--docs-renderer-code-paper));
	--docs-renderer-code-tint: color-mix(in srgb, var(--docs-renderer-accent) 25%, var(--docs-renderer-muted));
	--docs-renderer-code-rule: color-mix(in srgb, var(--docs-renderer-code-tint) 15%, var(--docs-renderer-code-paper));
	--docs-renderer-code-soft: color-mix(in srgb, var(--docs-renderer-accent) 1.5%, var(--docs-renderer-code-paper));
	--docs-renderer-code-height: 430px;

	color: var(--docs-renderer-ink);

	@at-root .docs-renderer-node--hero + .docs-renderer-node--code #{&} {
		border-top: 0;
	}

	&.is-expanded {
		--docs-renderer-code-height: 540px;
	}

	&__window {
		max-width: 1200px;
		margin-inline: auto;
		overflow: hidden;
		background: var(--docs-renderer-code-paper);
		border: 1px solid var(--docs-renderer-code-rule);
		border-radius: 18px;
	}

	&.is-left &__window {
		margin-inline: 0 auto;
	}

	&.is-right &__window {
		margin-inline: auto 0;
	}

	&__bar {
		display: flex;
		height: 50px;
		gap: 12px;
		padding: 0 22px;
		background: var(--docs-renderer-code-soft);
		border-bottom: 1px solid var(--docs-renderer-code-rule);
		align-items: center;
	}

	&__file {
		display: inline-flex;
		min-width: 0;
		gap: 9px;
		font-family: SFMono-Regular, Consolas, monospace;
		font-size: 12px;
		overflow-wrap: anywhere;
		align-items: center;

		svg {
			width: 15px;
			height: 15px;
			color: var(--docs-renderer-accent);
			flex-shrink: 0;
		}
	}

	&__language {
		margin-left: auto;
		font-size: 10px;
		color: var(--docs-renderer-muted);
		white-space: nowrap;
	}

	&__copy {
		display: flex;
		height: 29px;
		min-width: 72px;
		padding: 0 10px;
		font: inherit;
		font-size: 11px;
		color: var(--docs-renderer-accent);
		cursor: pointer;
		background: color-mix(in srgb, var(--docs-renderer-accent) 5%, var(--docs-renderer-code-paper));
		border: 0;
		border-radius: 7px;
		transition: background 200ms ease;
		gap: 6px;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;

		svg {
			width: 13px;
			height: 13px;
		}

		&:hover, &.is-copied {
			background: color-mix(in srgb, var(--docs-renderer-accent) 10%, var(--docs-renderer-code-paper));
		}
	}

	&__lines {
		padding: 19px 0;
		margin: 0;
		font-family: SFMono-Regular, Consolas, monospace;
		font-size: 12px;
		line-height: 24px;
		list-style: none;
		tab-size: 2;
	}

	&__line {
		display: grid;
		min-height: 24px;
		padding-right: 23px;
		grid-template-columns: 48px minmax(0, 1fr);

		&.is-key {
			background: color-mix(in srgb, var(--docs-renderer-accent) 4%, var(--docs-renderer-code-paper));
			box-shadow: inset 2px 0 color-mix(in srgb, var(--docs-renderer-accent) 45%, transparent);
		}
	}

	&__number {
		padding-right: 17px;
		font-size: 10px;
		color: color-mix(in srgb, var(--docs-renderer-muted) 55%, var(--docs-renderer-code-paper));
		text-align: right;
		user-select: none;
	}

	&__source {
		font: inherit;
		white-space: pre;
	}

	&__fold {
		width: 100%;
		min-height: 24px;
		padding: 3px 12px;
		margin: 1px 0;
		font: inherit;
		font-size: 11px;
		color: var(--docs-renderer-muted);
		text-align: left;
		cursor: pointer;
		background: var(--docs-renderer-code-soft);
		border: 0;
		border-radius: 5px;

		&:hover {
			color: var(--docs-renderer-accent);
		}

		span {
			margin-right: 8px;
			color: var(--docs-renderer-accent);
		}
	}

	&__footer {
		display: flex;
		min-height: 48px;
		gap: 14px;
		padding: 10px 22px;
		border-top: 1px solid var(--docs-renderer-code-rule);
		align-items: center;
		justify-content: space-between;
		box-sizing: border-box;
	}

	&__note {
		font-size: 11px;
		line-height: 1.6;
		color: var(--docs-renderer-muted);
	}

	&__expand {
		padding: 3px 0;
		font: inherit;
		font-size: 11px;
		color: var(--docs-renderer-accent);
		cursor: pointer;
		background: none;
		border: 0;
		flex: 0 0 auto;

		span {
			display: inline-block;
			margin-left: 6px;
		}
	}

	&.is-expanded &__expand span {
		transform: rotate(180deg);
	}

	button:focus-visible {
		outline: 2px solid var(--docs-renderer-accent);
		outline-offset: 3px;
	}

	@container (width <= 760px) {
		--docs-renderer-code-height: 540px;

		&.is-expanded {
			--docs-renderer-code-height: 490px;
		}

		&__window {
			border-radius: 14px;
		}

		&__bar {
			height: 47px;
			gap: 9px;
			padding: 0 14px;
		}

		&__file {
			font-size: 11px;
		}

		&__language {
			font-size: 9px;
		}

		&__copy {
			min-width: 60px;
			padding: 0 8px;
			font-size: 10px;
		}

		&__lines {
			padding: 15px 0;
			font-size: 10.5px;
			line-height: 22px;
		}

		&__line {
			min-height: 22px;
			padding-right: 14px;
			grid-template-columns: 34px minmax(0, 1fr);
		}

		&__number {
			padding-right: 10px;
			font-size: 9px;
		}

		&__source {
			white-space: pre-wrap;
			overflow-wrap: anywhere;
		}

		&__fold {
			padding: 3px 7px;
			font-size: 10px;
		}

		&__footer {
			padding: 11px 14px;
			gap: 9px;
			align-items: flex-start;
			flex-direction: column;
		}

		&__note {
			font-size: 10px;
		}

		&__expand {
			align-self: flex-end;
		}
	}
}
</style>
