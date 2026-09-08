<template>
	<span v-if="value" class="docs-sidebar__icon">
		<img
			v-if="kind === 'url'"
			class="docs-sidebar__media"
			:src="src"
			alt=""
		>
		<Icon
			v-else-if="kind === 'type'"
			class="docs-sidebar__glyph"
			:type="value"
			inherit
		/>
	</span>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@deot/vc';
import type { SidebarItem } from '../../types';
import {
	pickSidebarIconValue,
	resolveSidebarIconKind,
	toSidebarIconSrc
} from '../../utils/sidebar-icon';

defineOptions({ name: 'DocsSidebarGlyph' });
const props = defineProps<{
	item: SidebarItem;
	selected?: boolean;
}>();
const value = computed(() => pickSidebarIconValue(props.item.icon, Boolean(props.selected)));
const kind = computed(() => resolveSidebarIconKind(value.value));
const src = computed(() => toSidebarIconSrc(value.value));
</script>
