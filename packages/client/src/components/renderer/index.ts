import { inject } from 'vue';
import type { App, InjectionKey } from 'vue';
import {
	BuiltinModules,
	RENDERER_SORTABLE_CONTENT_WIDTH,
	createRendererModuleCatalog,
	defineRendererModule
} from '@deot/docs-renderer';
import type {
	RendererModuleCatalog,
	RendererModuleSource
} from '@deot/docs-renderer';
import type { DocsConfig } from '../../types';
import MarkdownRenderer from './markdown.vue';
import MarkdownEditor from './markdown-editor.vue';
import SfcRenderer from './sfc.vue';
import SourceEditor from './source-editor.vue';
import {
	normalizeDocsMarkdownProps,
	validateDocsMarkdownProps
} from './markdown-props';
import type { DocsMarkdownProps } from './markdown-props';

const MarkdownModule = defineRendererModule<DocsMarkdownProps>({
	identity: { type: 'docs:markdown', version: 1, label: 'Markdown', category: 'Docs' },
	widget: { visible: true },
	data: {
		create: () => ({ source: '' }),
		normalize: normalizeDocsMarkdownProps,
		validate: validateDocsMarkdownProps
	},
	viewer: MarkdownRenderer,
	editor: MarkdownEditor,
	frames: {
		sortable: {
			movable: true,
			deletable: true,
			maxWidth: RENDERER_SORTABLE_CONTENT_WIDTH
		}
	},
	integrations: {
		collectResources: (props) => {
			if (typeof props.content === 'string') return [];
			const source = props.source.trim();
			return source ? [{ type: 'markdown', source }] : [];
		}
	}
});

const SfcModule = defineRendererModule<{ source: string }>({
	identity: { type: 'docs:sfc', version: 1, label: 'Remote SFC', category: 'Docs' },
	widget: { visible: true },
	data: {
		create: () => ({ source: '' }),
		normalize: (value) => {
			const source = value && typeof value === 'object' && 'source' in value
				? value.source
				: '';
			return { source: typeof source === 'string' ? source : '' };
		},
		validate: value => value.source
			? []
			: [{
					path: '$.source',
					code: 'source.required',
					message: 'SFC source 不能为空',
					severity: 'error'
				}]
	},
	viewer: SfcRenderer,
	editor: SourceEditor,
	frames: {
		sortable: {
			movable: true,
			deletable: true,
			maxWidth: RENDERER_SORTABLE_CONTENT_WIDTH
		}
	},
	integrations: {
		collectResources: props => typeof props.source === 'string' && props.source
			? [{ type: 'sfc', source: props.source }]
			: []
	}
});

export const ClientRendererModules = Object.freeze<readonly RendererModuleSource[]>([
	MarkdownModule,
	SfcModule
]);

const fallbackRendererModules = Object.freeze<readonly RendererModuleSource[]>([
	...BuiltinModules,
	...ClientRendererModules
]);

interface RendererRuntime {
	modules: readonly RendererModuleSource[];
	catalog: RendererModuleCatalog;
}

const runtimeCache = new WeakMap<DocsConfig, RendererRuntime>();
const rendererModulesKey: InjectionKey<readonly RendererModuleSource[]> = Symbol('docs-renderer-modules');

/**
 * 为同一个 DocsConfig 只创建一套不可变模块表，渲染、编辑、搜索和资源计划
 * 都复用该表，避免各处对模块能力产生不同理解。
 * @param config 当前文档站点配置。
 * @returns 与该配置绑定的模块表和只读 Catalog。
 */
export const getRendererRuntime = (config: DocsConfig): RendererRuntime => {
	let runtime = runtimeCache.get(config);
	if (!runtime) {
		const customModules = config.renderers || [];
		customModules.forEach((source) => {
			const type = 'identity' in source ? source.identity.type : source.type;
			if (type.startsWith('docs:')) {
				throw new TypeError(`Renderer module namespace is reserved: ${type}`);
			}
		});
		const modules = Object.freeze<readonly RendererModuleSource[]>([
			...BuiltinModules,
			...ClientRendererModules,
			...customModules
		]);
		runtime = { modules, catalog: createRendererModuleCatalog(modules) };
		runtimeCache.set(config, runtime);
	}
	return runtime;
};

export const provideRendererModules = (app: App, config: DocsConfig) => {
	app.provide(rendererModulesKey, getRendererRuntime(config).modules);
};

export const useRendererModules = () => inject(rendererModulesKey, fallbackRendererModules);
