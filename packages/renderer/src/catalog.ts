import type {
	RendererLazyModuleSource,
	RendererModuleDefinition,
	RendererModuleSource
} from './types';

const isLazySource = (source: RendererModuleSource): source is RendererLazyModuleSource => (
	'load' in source && typeof source.load === 'function'
);

const validateCapability = (
	type: string,
	capability: RendererModuleDefinition['frames']['sortable']
		| RendererModuleDefinition['frames']['draggable']
) => {
	if (!capability) return;
	if (
		typeof capability.maxInstances !== 'undefined'
		&& (!Number.isInteger(capability.maxInstances) || capability.maxInstances < 1)
	) {
		throw new TypeError(`Renderer module maxInstances must be a positive integer: ${type}`);
	}
	if ('initialPlacement' in capability) {
		(['minWidth', 'minHeight', 'maxWidth', 'maxHeight', 'aspectRatio'] as const).forEach((key) => {
			const value = capability[key];
			if (typeof value !== 'undefined' && (!Number.isFinite(value) || value <= 0)) {
				throw new TypeError(`Renderer module ${key} must be a positive number: ${type}`);
			}
		});
		if (
			capability.minWidth
			&& capability.maxWidth
			&& capability.minWidth > capability.maxWidth
		) {
			throw new TypeError(`Renderer module minWidth cannot exceed maxWidth: ${type}`);
		}
		if (
			capability.minHeight
			&& capability.maxHeight
			&& capability.minHeight > capability.maxHeight
		) {
			throw new TypeError(`Renderer module minHeight cannot exceed maxHeight: ${type}`);
		}
	}
};

const validateDefinition = (definition: RendererModuleDefinition, expectedType?: string) => {
	const { type, version } = definition.identity;
	if (!type.trim()) throw new TypeError('Renderer module type cannot be empty');
	if (expectedType && type !== expectedType) {
		throw new TypeError(`Renderer module type mismatch: ${expectedType}`);
	}
	if (!Number.isInteger(version) || version < 1) {
		throw new TypeError(`Renderer module version must be a positive integer: ${type}`);
	}
	if (!definition.frames.sortable && !definition.frames.draggable) {
		throw new TypeError(`Renderer module must support at least one frame: ${type}`);
	}
	validateCapability(type, definition.frames.sortable);
	validateCapability(type, definition.frames.draggable);
	const sortable = definition.frames.sortable;
	if (sortable && typeof sortable.maxWidth !== 'undefined') {
		if (!Number.isFinite(sortable.maxWidth) || sortable.maxWidth <= 0) {
			throw new TypeError(`Renderer module maxWidth must be a positive number: ${type}`);
		}
	}
	[definition.widget, definition.frames.sortable?.widget, definition.frames.draggable?.widget]
		.filter(Boolean)
		.forEach((widget) => {
			const keys = new Set<string>();
			widget!.presets?.forEach((preset) => {
				if (!preset.key.trim() || keys.has(preset.key)) {
					throw new TypeError(`Renderer module preset key is invalid or duplicated: ${type}/${preset.key}`);
				}
				keys.add(preset.key);
			});
		});
	return definition;
};

export const defineRendererModule = <Props extends object>(
	definition: RendererModuleDefinition<Props>
) => definition;

/**
 * 模块 Catalog 只属于单个 Combo 或 Renderer。它缓存延迟模块，但不提供注册
 * 方法，从根源上避免多个实例和测试之间共享可变模块状态。
 */
export class RendererModuleCatalog {
	private sources = new Map<string, RendererModuleSource>();
	private pending = new Map<string, Promise<RendererModuleDefinition>>();

	constructor(sources: readonly RendererModuleSource[]) {
		sources.forEach((source) => {
			const type = isLazySource(source) ? source.type : validateDefinition(source).identity.type;
			if (!type.trim()) throw new TypeError('Renderer module type cannot be empty');
			if (this.sources.has(type)) throw new TypeError(`Renderer module already exists: ${type}`);
			this.sources.set(type, source);
		});
	}

	has(type: string) {
		return this.sources.has(type);
	}

	types() {
		return [...this.sources.keys()];
	}

	async get(type: string): Promise<RendererModuleDefinition | null> {
		const source = this.sources.get(type);
		if (!source) return null;
		if (!isLazySource(source)) return source;
		let request = this.pending.get(type);
		if (!request) {
			request = source.load().then((result) => {
				const definition = 'default' in result ? result.default : result;
				return validateDefinition(definition, type);
			});
			this.pending.set(type, request);
		}
		try {
			return await request;
		} catch (error) {
			this.pending.delete(type);
			throw error;
		}
	}

	async list() {
		const definitions = await Promise.allSettled(this.types().map(type => this.get(type)));
		return definitions.flatMap(result => (
			result.status === 'fulfilled' && result.value ? [result.value] : []
		));
	}
}

export const createRendererModuleCatalog = (sources: readonly RendererModuleSource[]) => (
	new RendererModuleCatalog(sources)
);
