<template>
	<section
		class="docs-renderer-ads"
		:class="{
			[`is-${layout}`]: true,
			[`is-${style}`]: true,
			'is-looping': looping
		}"
		:style="rootStyle"
	>
		<div class="docs-renderer-ads__viewport">
			<div class="docs-renderer-ads__track">
				<div v-for="copy in copies" :key="copy" class="docs-renderer-ads__set">
					<component
						:is="tagOf(item)"
						v-for="(item, index) in items"
						:key="`${copy}-${index}`"
						class="docs-renderer-ads__item"
						:class="{ 'is-plain': !srcOf(index) }"
						:href="tagOf(item) === 'a' ? hrefOf(item) : undefined"
						:target="tagOf(item) === 'a' ? '_blank' : undefined"
						:rel="tagOf(item) === 'a' ? 'noopener noreferrer' : undefined"
						:aria-label="String(item.title || item.alt || '')"
						@click="event => handleClick(event, item)"
					>
						<div v-if="srcOf(index)" class="docs-renderer-ads__visual">
							<img
								class="docs-renderer-ads__media"
								:src="srcOf(index)"
								:alt="String(item.alt || item.title || '')"
								loading="lazy"
							>
						</div>
						<span v-else class="docs-renderer-ads__fallback" aria-hidden="true">{{ markOf(item) }}</span>
						<span v-if="item.title" class="docs-renderer-ads__title">{{ item.title }}</span>
					</component>
				</div>
			</div>
		</div>
	</section>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CSSProperties } from 'vue';
import type { RendererModuleViewerProps } from '../../../types';
import { isUnsafeHref, toEnumValue, toLength, toRecord } from '../../shared/utils';
import { resolveImageSource } from '../../shared/image-source';
import { ADS_LAYOUTS, ADS_STYLES } from './constants';

const props = defineProps<RendererModuleViewerProps>();
const resolved = ref<string[]>([]);
let generation = 0;
const items = computed(() => (
	Array.isArray(props.node.module.props.items) ? props.node.module.props.items : []
).map(toRecord));
const layout = computed(() => toEnumValue(props.node.module.props.layout, ADS_LAYOUTS, 'tile'));
const style = computed(() => toEnumValue(props.node.module.props.style, ADS_STYLES, 'banner'));
const looping = computed(() => layout.value === 'scroll' && items.value.length > 1);
const copies = computed(() => looping.value ? [0, 1] : [0]);
const interactive = computed(() => props.context.readonly);
const resolve = async (value: unknown) => resolveImageSource(
	value,
	props.context.services?.resolveAsset,
	props.context.source
);
watch(
	() => [
		items.value.map(item => String(item.src)).join('\0'),
		props.context.source,
		props.context.services?.resolveAsset
	] as const,
	async () => {
		const active = ++generation;
		try {
			const values = await Promise.all(items.value.map(item => resolve(item.src)));
			if (active === generation) resolved.value = values;
		} catch {
			if (active === generation) resolved.value = items.value.map(() => '');
		}
	},
	{ immediate: true }
);
const rootStyle = computed(() => {
	const columns = Math.max(1, toLength(props.node.module.props.columns, 2));
	const gap = Math.max(0, toLength(props.node.module.props.gap, 12));
	const height = Math.max(80, toLength(props.node.module.props.height, 180));
	const speed = Math.max(2, toLength(props.node.module.props.speed, 4));
	return {
		'--docs-renderer-columns': columns,
		'--docs-renderer-gap': `${gap}px`,
		'--docs-renderer-ads-height': `${height}px`,
		'--docs-renderer-ads-duration': `${Math.max(8, items.value.length * speed)}s`
	} as CSSProperties;
});
const srcOf = (index: number) => resolved.value[index] || '';
const markOf = (item: Record<string, unknown>) => {
	const title = String(item.title || item.alt || '').trim();
	return title ? [...title][0] : '●';
};
const hrefValue = (item: Record<string, unknown>) => String(item.href || '').trim();
const unsafe = (value: string) => isUnsafeHref(value);
const external = (value: string) => /^[a-z][a-z\d+.-]*:/iu.test(value) || value.startsWith('//');
const tagOf = (item: Record<string, unknown>) => {
	const value = hrefValue(item);
	return value && !unsafe(value) && interactive.value ? 'a' : 'div';
};
const hrefOf = (item: Record<string, unknown>) => {
	const value = hrefValue(item);
	if (!value || unsafe(value)) return '';
	return external(value) ? value : props.context.services?.resolveLink?.(value) || value;
};
const handleClick = async (event: MouseEvent, item: Record<string, unknown>) => {
	if (!interactive.value) {
		event.preventDefault();
		return;
	}
	const value = hrefValue(item);
	if (!value || unsafe(value) || external(value)) return;
	if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
	if (!props.context.services?.navigate) return;
	event.preventDefault();
	try {
		await props.context.services.navigate(value);
	} catch {
		// 导航失败由宿主处理，Viewer 保持当前页面。
	}
};
</script>
<style lang="scss">
@use '../../../../node_modules/@deot/docs-theme/src/functions' as *;

.docs-renderer-ads {
	--docs-renderer-accent: varfix(primary-color);

	min-width: 0;

	&__viewport,
	&__track,
	&__set,
	&__item {
		min-width: 0;
	}

	&__item {
		position: relative;
		display: grid;
		overflow: hidden;
		color: inherit;
		text-decoration: none;
		background: varfix(background-color);
		isolation: isolate;
		align-content: stretch;
		transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.28s ease, border-color 0.2s ease;

		&:focus-visible {
			outline: 2px solid var(--docs-renderer-accent);
			outline-offset: 3px;
		}
	}

	&__visual {
		display: grid;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	&__media {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		transition: transform 0.5s ease;
	}

	&__item:hover &__media {
		transform: scale(1.04);
	}

	&__fallback {
		display: grid;
		font-size: 18px;
		font-weight: 700;
		line-height: 1;
		color: var(--docs-renderer-accent);
		background:
			radial-gradient(circle at 80% 20%, color-mix(in srgb, var(--docs-renderer-accent) 22%, transparent), transparent 42%),
			color-mix(in srgb, var(--docs-renderer-accent) 12%, varfix(background-color-soft));
		place-items: center;
	}

	&__title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	&.is-tile &__viewport,
	&.is-tile &__track,
	&.is-tile &__set {
		display: contents;
	}

	&.is-tile {
		display: grid;
		grid-template-columns: repeat(var(--docs-renderer-columns, 2), minmax(0, 1fr));
		gap: var(--docs-renderer-gap, 12px);
	}

	&.is-tile &__item:hover {
		transform: translateY(-4px);
		box-shadow: 0 14px 28px color-mix(in srgb, var(--docs-renderer-accent) 14%, transparent);
	}

	&.is-scroll {
		&__viewport {
			height: var(--docs-renderer-ads-height, 180px);
			overflow: hidden;
			border-radius: 16px;
		}

		&__track {
			display: flex;
			flex-direction: column;
		}

		&__set {
			display: flex;
			padding-bottom: var(--docs-renderer-gap, 12px);
			gap: var(--docs-renderer-gap, 12px);
			flex-direction: column;
			flex: 0 0 auto;
		}

		&.is-looping &__track {
			animation: docs-renderer-ads-scroll var(--docs-renderer-ads-duration, 12s) linear infinite;
		}

		&.is-banner &__item,
		&.is-poster &__item {
			height: var(--docs-renderer-ads-height, 180px);
			aspect-ratio: auto;
		}
	}

	&.is-banner &__item {
		aspect-ratio: 2.4 / 1;
		min-height: 112px;
		border: 1px solid varfix(border-color-light);
		border-radius: 16px;

		.docs-renderer-ads__visual {
			position: absolute;
			inset: 0;
		}

		.docs-renderer-ads__title {
			position: relative;
			z-index: 1;
			align-self: end;
			padding: 28px 18px 16px;
			font-size: 15px;
			font-weight: 600;
			line-height: 1.35;
			letter-spacing: -0.02em;
			color: #fff;
			background: linear-gradient(180deg, transparent, rgb(0 0 0 / 58%));
		}

		&.is-plain {
			aspect-ratio: auto;
			min-height: 96px;
			padding: 18px 20px;
			background:
				linear-gradient(
					135deg,
					color-mix(in srgb, var(--docs-renderer-accent) 14%, varfix(background-color)) 0%,
					varfix(background-color) 62%
				);
			grid-template-columns: auto minmax(0, 1fr);
			gap: 14px;
			align-items: center;

			.docs-renderer-ads__fallback {
				width: 40px;
				height: 40px;
				border-radius: 12px;
			}

			.docs-renderer-ads__title {
				padding: 0;
				color: varfix(foreground-color);
				background: none;
				align-self: center;
			}
		}
	}

	&.is-card &__item {
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--docs-renderer-accent) 8%, varfix(background-color)) 0%,
				varfix(background-color) 42%
			);
		border: 1px solid varfix(border-color-light);
		border-radius: 16px;
		align-content: start;

		.docs-renderer-ads__visual,
		.docs-renderer-ads__fallback {
			aspect-ratio: 16 / 10;
			height: auto;
		}

		.docs-renderer-ads__fallback {
			font-size: 28px;
		}

		.docs-renderer-ads__title {
			padding: 12px 14px 14px;
			font-size: 14px;
			font-weight: 600;
			line-height: 1.45;
			color: varfix(foreground-color);
		}

		&.is-plain .docs-renderer-ads__fallback {
			min-height: 88px;
		}
	}

	&.is-poster &__item {
		aspect-ratio: 4 / 5;
		border: 1px solid varfix(border-color-light);
		border-radius: 18px;

		.docs-renderer-ads__visual,
		.docs-renderer-ads__fallback {
			position: absolute;
			inset: 0;
		}

		.docs-renderer-ads__fallback {
			font-size: 36px;
		}

		.docs-renderer-ads__title {
			position: relative;
			z-index: 1;
			align-self: end;
			padding: 36px 16px 16px;
			font-size: 15px;
			font-weight: 600;
			line-height: 1.4;
			letter-spacing: -0.02em;
			color: #fff;
			text-wrap: balance;
			background: linear-gradient(180deg, transparent, rgb(0 0 0 / 66%));
		}

		&.is-plain {
			background:
				linear-gradient(
					180deg,
					color-mix(in srgb, var(--docs-renderer-accent) 16%, varfix(background-color)) 0%,
					varfix(background-color) 70%
				);

			.docs-renderer-ads__fallback {
				inset: 18px 18px auto;
				width: 48px;
				height: 48px;
				font-size: 18px;
				border-radius: 14px;
			}

			.docs-renderer-ads__title {
				padding: 20px 18px 18px;
				color: varfix(foreground-color);
				background: none;
			}
		}
	}

	&.is-notice &__item {
		min-height: 72px;
		padding: 10px 14px 10px 10px;
		grid-template-columns: 52px minmax(0, 1fr);
		gap: 12px;
		background: color-mix(in srgb, var(--docs-renderer-accent) 6%, varfix(background-color));
		border: 1px solid varfix(border-color-light);
		border-radius: 14px;
		align-items: center;

		.docs-renderer-ads__visual,
		.docs-renderer-ads__media,
		.docs-renderer-ads__fallback {
			width: 52px;
			height: 52px;
		}

		.docs-renderer-ads__visual,
		.docs-renderer-ads__fallback {
			border-radius: 12px;
		}

		.docs-renderer-ads__title {
			font-size: 14px;
			font-weight: 600;
			line-height: 1.45;
			color: varfix(foreground-color);
		}

		&:hover {
			border-color: color-mix(in srgb, var(--docs-renderer-accent) 36%, varfix(border-color));
		}
	}

	@media (width <= 860px) {
		&.is-tile {
			grid-template-columns: minmax(0, 1fr);
		}

		&.is-banner &__item:not(.is-plain) {
			aspect-ratio: 16 / 9;
		}

		&.is-poster &__item {
			aspect-ratio: 3 / 4;
			max-width: 320px;
			margin-inline: auto;
		}
	}
}

@media (prefers-reduced-motion: reduce) {
	.docs-renderer-ads.is-looping .docs-renderer-ads__track {
		animation: none;
	}

	.docs-renderer-ads__item,
	.docs-renderer-ads__media {
		transform: none !important;
		transition: none !important;
	}
}

@keyframes docs-renderer-ads-scroll {
	from {
		transform: translateY(0);
	}

	to {
		transform: translateY(-50%);
	}
}

.docs-renderer-node.is-editing .docs-renderer-ads.is-looping .docs-renderer-ads__track,
.docs-renderer-ads.is-looping:hover .docs-renderer-ads__track {
	animation-play-state: paused;
}
</style>
