import type { Plugin, UserConfig } from 'vite';

// 仅用于故意构造非法输入。
export const invalid = <T>(value: unknown) => value as T;

export const pluginsOf = (config: UserConfig): Plugin[] => (
	(config.plugins || []).flat().filter((plugin): plugin is Plugin => (
		Boolean(plugin && typeof plugin === 'object' && 'name' in plugin)
	))
);

export const findPlugin = (config: UserConfig, name: string) => {
	const plugin = pluginsOf(config).find(item => item.name === name);
	if (!plugin) throw new Error(`missing plugin ${name}`);
	return plugin;
};

export const pluginHook = (
	hook: unknown,
	name: string
): ((...args: unknown[]) => unknown) => {
	if (typeof hook === 'function') return hook as (...args: unknown[]) => unknown;
	if (
		hook
		&& typeof hook === 'object'
		&& 'handler' in hook
		&& typeof hook.handler === 'function'
	) {
		return hook.handler as (...args: unknown[]) => unknown;
	}
	throw new Error(`missing ${name}`);
};

export const htmlTagsOf = (value: unknown) => {
	if (!Array.isArray(value)) throw new TypeError('expected html tags');
	return value as Array<{ tag?: string; injectTo?: string; children?: string }>;
};
