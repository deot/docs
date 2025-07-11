import { defineConfig } from 'vitest/config';
import type { UserConfig } from 'vite';

export default defineConfig({
	plugins: [],

	// 因为virtualHtml不需要入口，这样可以不弹出Skipping dependency pre-bundling.
	optimizeDeps: { entries: [] }
}) as UserConfig;
