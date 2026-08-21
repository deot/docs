<template>
	<aside class="docs-renderer-widget">
		<div class="docs-renderer-widget__wrapper">
			<p class="docs-renderer-widget__header">{{ t('renderer.modules.title') }}</p>
			<div v-if="showTip" class="docs-renderer-widget__tip">
				<span class="docs-renderer-widget__icon-warn">!</span>
				<p>{{ t('renderer.modules.dragTip') }}</p>
				<button
					type="button"
					class="docs-renderer-widget__tip-close"
					:aria-label="t('renderer.common.close')"
					@click="showTip = false"
				>
					✕
				</button>
			</div>
			<div class="docs-renderer-widget__menu">
				<div class="docs-renderer-widget__tabs">
					<button
						v-for="group in groups"
						:key="group.name"
						type="button"
						class="docs-renderer-widget__tab"
						:class="{ 'is-active': currentTab === group.name }"
						@click="currentTab = group.name"
					>
						{{ group.name }}
					</button>
				</div>
				<Scroller height="100%" :native="false" :show-bar="true">
					<div class="docs-renderer-widget__content">
						<template v-for="module in currentItems" :key="module.identity.type">
							<button
								v-if="!getWidget(module).presets?.length"
								type="button"
								class="docs-renderer-widget__item"
								:disabled="!canCreate(module)"
								:draggable="canCreate(module)"
								@dragstart="event => handleDrag(event, module.identity.type)"
								@dragend="endWidgetDrag"
								@click="emit('create', { type: module.identity.type })"
							>
								<span class="docs-renderer-widget__preview">
									<component v-if="getWidget(module).component" :is="getWidget(module).component" />
									<span v-else class="docs-renderer-widget__glyph" aria-hidden="true" />
								</span>
								<span class="docs-renderer-widget__label">{{ text(module.identity.label) }}</span>
							</button>
							<div v-else class="docs-renderer-widget__group">
								<button
									type="button"
									class="docs-renderer-widget__title is-click"
									:class="{ 'is-active': isExpanded(module.identity.type) }"
									@click="toggleExpanded(module.identity.type)"
								>
									<span>{{ text(module.identity.label) }}</span>
									<i class="docs-renderer-widget__arrow" />
								</button>
								<div v-if="isExpanded(module.identity.type)" class="docs-renderer-widget__presets">
									<button
										v-for="preset in getWidget(module).presets"
										:key="preset.key"
										type="button"
										class="docs-renderer-widget__item"
										:disabled="!canCreate(module)"
										:draggable="canCreate(module)"
										@dragstart="event => handleDrag(event, module.identity.type, preset.key)"
										@dragend="endWidgetDrag"
										@click="emit('create', { type: module.identity.type, presetKey: preset.key })"
									>
										<span class="docs-renderer-widget__preview">
											<component v-if="typeof preset.preview === 'object'" :is="preset.preview" />
											<img v-else-if="typeof preset.preview === 'string'" :src="preset.preview" alt="">
											<span v-else class="docs-renderer-widget__glyph" aria-hidden="true" />
										</span>
										<span class="docs-renderer-widget__label">{{ text(preset.label) }}</span>
									</button>
								</div>
							</div>
						</template>
					</div>
				</Scroller>
			</div>
		</div>
	</aside>
</template>
<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { Scroller } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import type { RendererModuleCatalog } from '../catalog';
import type {
	RendererFrameMode,
	RendererDocument,
	RendererModuleContext,
	RendererModuleDefinition
} from '../types';
import { resolveLocaleText } from '../modules/shared/utils';
import {
	RENDERER_WIDGET_MIME,
	beginWidgetDrag,
	endWidgetDrag
} from './constants';
import type { RendererCreateTarget } from './constants';

const props = defineProps<{
	catalog: RendererModuleCatalog;
	mode: RendererFrameMode;
	context: RendererModuleContext;
	document: Readonly<RendererDocument>;
}>();
const emit = defineEmits<{
	create: [payload: RendererCreateTarget];
}>();
const { t } = useLocale(computed(() => props.context.locale));
const showTip = ref(true);
const currentTab = ref('');
const expanded = ref<Record<string, boolean>>({});
const definitions = shallowRef<RendererModuleDefinition[]>([]);
let generation = 0;
const getWidget = (module: RendererModuleDefinition) => module.frames[props.mode]?.widget || module.widget;
const canCreate = (module: RendererModuleDefinition) => {
	const max = module.frames[props.mode]?.maxInstances;
	if (!max) return true;
	return props.document.blocks.filter(node => node.module.type === module.identity.type).length < max;
};
watch(() => [props.catalog, props.mode] as const, async () => {
	const active = ++generation;
	const values = await props.catalog.list();
	if (active === generation) definitions.value = values.filter(value => (
		getWidget(value).visible !== false && Boolean(value.frames[props.mode])
	));
}, { immediate: true });
const text = (value: Parameters<typeof resolveLocaleText>[0]) => resolveLocaleText(value, props.context);
const groups = computed(() => {
	const result = new Map<string, RendererModuleDefinition[]>();
	definitions.value.forEach((module) => {
		const name = text(module.identity.category);
		const values = result.get(name) || [];
		values.push(module);
		result.set(name, values);
	});
	return [...result].map(([name, items]) => ({ name, items }));
});
const currentItems = computed(() => (
	groups.value.find(group => group.name === currentTab.value)?.items || []
));
watch(groups, (value) => {
	if (!value.some(group => group.name === currentTab.value)) {
		currentTab.value = value[0]?.name || '';
	}
}, { immediate: true });
watch(
	() => [currentTab.value, currentItems.value.map(item => item.identity.type).join('|')] as const,
	() => {
		const first = currentItems.value.find(item => getWidget(item).presets?.length);
		expanded.value = first ? { [first.identity.type]: true } : {};
	},
	{ immediate: true }
);
const isExpanded = (type: string) => Boolean(expanded.value[type]);
const toggleExpanded = (type: string) => {
	expanded.value = { ...expanded.value, [type]: !expanded.value[type] };
};
const handleDrag = (event: DragEvent, type: string, presetKey?: string) => {
	const definition = definitions.value.find(value => value.identity.type === type);
	if (!definition || !canCreate(definition)) {
		event.preventDefault();
		return;
	}
	const placement = definition.frames.draggable?.initialPlacement?.();
	beginWidgetDrag({
		type,
		presetKey,
		width: placement?.width || 200,
		height: placement?.height || 120
	});
	event.dataTransfer?.setData(RENDERER_WIDGET_MIME, JSON.stringify({ type, presetKey }));
	if (event.dataTransfer) {
		event.dataTransfer.effectAllowed = 'copy';
		const target = event.currentTarget;
		if (target instanceof HTMLElement) {
			try {
				event.dataTransfer.setDragImage(target, target.clientWidth / 2, target.clientHeight / 2);
			} catch {
				// jsdom / 部分环境不支持 setDragImage。
			}
		}
	}
};
</script>
<style lang="scss">
@use '../../node_modules/@deot/docs-theme/src/functions' as *;

.docs-renderer-widget {
	width: 284px;
	min-width: 0;
	min-height: 0;
	background: varfix(background-color);
	border-right: 1px solid varfix(border-color);
	box-sizing: border-box;
	flex: 0 0 284px;

	&__wrapper {
		display: flex;
		height: 100%;
		padding: 10px 0 0;
		background: varfix(background-color);
		flex-direction: column;
		align-items: stretch;
	}

	&__header {
		padding: 8px 15px;
		margin: 0;
		font-size: 15px;
		font-weight: 400;
		color: varfix(foreground-color);
	}

	&__tip {
		display: flex;
		height: 40px;
		padding: 0 10px;
		margin: 2px 9px 15px;
		font-size: 12px;
		color: varfix(foreground-color-light);
		background: color-mix(in srgb, #ec9c39 18%, varfix(background-color-soft));
		border: 0;
		border-radius: 4px;
		align-items: center;

		p {
			flex: 1;
			margin: 0;
			line-height: 1.4;
		}
	}

	&__icon-warn {
		flex: none;
		width: 14px;
		height: 14px;
		margin-right: 7px;
		font-size: 12px;
		line-height: 14px;
		color: #fff;
		text-align: center;
		background: #ec9c39;
		border-radius: 100%;
	}

	&__tip-close {
		flex: none;
		padding: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
		background: transparent;
		border: 0;
	}

	&__menu {
		display: flex;
		min-height: 0;
		border-top: 1px solid varfix(border-color);
		flex: 1;
		align-items: stretch;

		> .vc-scroller {
			min-width: 0;
			min-height: 0;
			flex: 1;
		}
	}

	&__tabs {
		display: flex;
		flex: none;
		width: 48px;
		padding: 0;
		overflow: auto;
		font-size: 12px;
		color: varfix(foreground-color-mute);
		border-right: 1px solid varfix(border-color);
		flex-direction: column;
	}

	&__tab {
		height: 49px;
		padding: 0 4px;
		font: inherit;
		color: inherit;
		text-align: center;
		cursor: pointer;
		background: transparent;
		border: 0;

		&.is-active {
			color: varfix(foreground-color);
			background: varfix(background-color-mute);
		}
	}

	&__content {
		display: flex;
		width: 236px;
		padding: 8px;
		box-sizing: border-box;
		gap: 8px;
		align-content: flex-start;
		flex-wrap: wrap;
	}

	&__group {
		display: flex;
		flex: 0 0 100%;
		min-width: 0;
		overflow: hidden;
		background: varfix(background-color);
		border: 1px solid varfix(border-color);
		border-radius: 6px;
		flex-direction: column;
	}

	&__title {
		display: flex;
		width: 100%;
		padding: 10px 12px;
		font: inherit;
		font-size: 12px;
		color: varfix(foreground-color);
		text-align: left;
		cursor: pointer;
		background: transparent;
		border: 0;
		justify-content: space-between;
		align-items: center;

		&:hover {
			color: varfix(primary-color);
		}

		&.is-active {
			color: varfix(primary-color);
			background: varfix(primary-color-light);

			.docs-renderer-widget__arrow {
				border-color: currentcolor;
				transform: rotate(-135deg);
			}
		}
	}

	&__arrow {
		width: 8px;
		height: 8px;
		border: 2px solid varfix(border-color);
		border-top: 0;
		border-left: 0;
		transform: rotate(45deg);
		transition: transform 0.2s ease-in-out;
	}

	&__presets {
		display: flex;
		width: 100%;
		padding: 8px;
		background: varfix(background-color-soft);
		border-top: 1px solid varfix(border-color-light);
		box-sizing: border-box;
		gap: 8px;
		flex-wrap: wrap;
	}

	&__item {
		display: flex;
		min-width: 0;
		padding: 8px 6px 6px;
		font: inherit;
		font-size: 12px;
		line-height: 1.3;
		color: varfix(foreground-color);
		text-align: center;
		cursor: grab;
		background: varfix(background-color);
		border: 1px solid varfix(border-color);
		border-radius: 6px;
		box-sizing: border-box;
		flex: 0 0 calc((100% - 8px) / 2);
		flex-direction: column;
		align-items: stretch;
		gap: 6px;

		&:hover:not(:disabled) {
			color: varfix(primary-color);
			background: varfix(primary-color-light);
			border-color: varfix(primary-color);

			.docs-renderer-widget__preview {
				color: inherit;
			}
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.45;
		}
	}

	&__preview {
		display: flex;
		height: 44px;
		overflow: hidden;
		color: varfix(foreground-color-mute);
		background: varfix(background-color-soft);
		border-radius: 4px;
		align-items: center;
		justify-content: center;

		img {
			max-width: 100%;
			max-height: 100%;
			object-fit: contain;
		}
	}

	&__glyph {
		display: block;
		width: 36px;
		height: 24px;
		background:
			linear-gradient(currentcolor, currentcolor) 0 2px / 36px 3px no-repeat,
			linear-gradient(currentcolor, currentcolor) 0 10.5px / 26px 3px no-repeat,
			linear-gradient(currentcolor, currentcolor) 0 19px / 18px 3px no-repeat;
		opacity: 0.38;
	}

	&__label {
		padding: 0 2px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&__error {
		margin-top: 12px;
		font-size: 12px;
		color: varfix(error-color);
	}
}
</style>
