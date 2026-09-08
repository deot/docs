import { ref } from 'vue';
import type { SidebarItem } from '../types';

const items = ref<SidebarItem[] | null>(null);

export const sidebarItems = items;

export const setSidebarItems = (next: SidebarItem[] | null) => {
	items.value = next;
};
