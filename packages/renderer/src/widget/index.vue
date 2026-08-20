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
