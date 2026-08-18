import type { RendererDocument } from '@deot/docs-renderer';
import { createSortableDemo } from './sortable';
import { createLandingDemo } from './landing';
import { createSharedDemo } from './shared';
import { createPromoDemo } from './promo';
import { createDocsDemo } from './docs';
import { createComboDemo } from './combo';
import { createDraggableDemo } from './draggable';
import { createSelectionDemo } from './selection';
import { copy } from './helpers';

/**
 * development 下 `/renderer-editor-demos?name=` 演示清单。
 * 工厂返回值可直接赋给 `$docs.home` 或路由 `content`。
 */
export const RENDERER_EDITOR_DEMOS = [
	'sortable',
	'landing',
	'shared',
	'promo',
	'docs',
	'combo',
	'draggable',
	'selection'
] as const;

export type RendererEditorDemo = typeof RENDERER_EDITOR_DEMOS[number];

export interface RendererEditorDemoItem {
	name: RendererEditorDemo;
	title: string;
	description: string;
	/**
	 * 该演示用到的模块 type 列表。
	 */
	modules: readonly string[];
	/**
	 * 演示卡片强调色。
	 */
	accent: string;
}

const factories: Record<RendererEditorDemo, (lang: string) => RendererDocument> = {
	sortable: createSortableDemo,
	landing: createLandingDemo,
	shared: createSharedDemo,
	promo: createPromoDemo,
	docs: createDocsDemo,
	combo: createComboDemo,
	draggable: createDraggableDemo,
	selection: createSelectionDemo
};

const catalog: Record<RendererEditorDemo, Omit<RendererEditorDemoItem, 'name' | 'title' | 'description'> & {
	title: [string, string];
	description: [string, string];
}> = {
	sortable: {
		title: ['流式画布', 'Sortable canvas'],
		description: ['空白上下流，对照 Widget 拖入。', 'Empty flow canvas for widget drops.'],
		modules: [],
		accent: '#5b6b8c'
	},
	landing: {
		title: ['落地页组合', 'Landing composition'],
		description: ['Hero → Features → Steps → FAQ → CTA。', 'Hero → Features → Steps → FAQ → CTA.'],
		modules: ['hero', 'features', 'steps', 'faq', 'cta'],
		accent: '#873bf4'
	},
	shared: {
		title: ['基础模块', 'Shared modules'],
		description: ['Title / Text / List / Image / 图片热区 / Actions / Space。', 'Title / Text / List / Image / Image hotspots / Actions / Space.'],
		modules: ['title', 'text', 'list', 'image', 'area', 'actions', 'space'],
		accent: '#2d8cf0'
	},
	promo: {
		title: ['广告位样式', 'Promo placements'],
		description: ['ads 的 banner / card / poster / notice。', 'ads banner / card / poster / notice.'],
		modules: ['ads'],
		accent: '#ed6a0c'
	},
	docs: {
		title: ['文档模块', 'Docs modules'],
		description: ['docs:markdown 与 docs:sfc。', 'docs:markdown and docs:sfc.'],
		modules: ['docs:markdown', 'docs:sfc'],
		accent: '#19be6b'
	},
	combo: {
		title: ['混合组合', 'Mixed composition'],
		description: ['落地模块、Markdown 和广告位混排。', 'Landing blocks mixed with Markdown and ads.'],
		modules: ['hero', 'docs:markdown', 'features', 'ads', 'cta'],
		accent: '#c23bd6'
	},
	draggable: {
		title: ['自由画布', 'Free canvas'],
		description: ['带坐标的 Title / Text / Image / Actions / Ads。', 'Positioned Title / Text / Image / Actions / Ads.'],
		modules: ['title', 'text', 'image', 'actions', 'ads'],
		accent: '#f5a623'
	},
	selection: {
		title: ['组合框', 'Selection group'],
		description: ['预置 selection 多选组合。', 'A prebuilt selection group.'],
		modules: ['title', 'text', 'image', 'selection'],
		accent: '#13c2c2'
	}
};

export const isRendererEditorDemo = (value: unknown): value is RendererEditorDemo => (
	typeof value === 'string' && (RENDERER_EDITOR_DEMOS as readonly string[]).includes(value)
);

/**
 * 组装演示目录或单个演示的路径。
 * @param lang 当前文档语言。
 * @param demo 演示名；缺省时进入目录。
 * @returns development 下的 `/:lang/renderer-editor-demos` 或带 `name` 的查询串。
 */
export const rendererEditorDemoPath = (lang: string, demo?: RendererEditorDemo) => (
	demo ? `/${lang}/renderer-editor-demos?name=${demo}` : `/${lang}/renderer-editor-demos`
);

/**
 * 当前语言下的演示卡片文案。
 * @param lang 当前文档语言。
 * @returns 目录卡片列表。
 */
export const listRendererEditorDemos = (lang: string): RendererEditorDemoItem[] => (
	RENDERER_EDITOR_DEMOS.map(name => ({
		name,
		title: copy(lang, ...catalog[name].title),
		description: copy(lang, ...catalog[name].description),
		modules: catalog[name].modules,
		accent: catalog[name].accent
	}))
);

/**
 * 生成一份可复制到业务配置的演示文档。
 * @param demo 演示名。
 * @param lang 当前文档语言。
 * @returns 对应演示的 V2 文档。
 */
export const createRendererEditorDemoDocument = (
	demo: RendererEditorDemo,
	lang: string
): RendererDocument => factories[demo](lang);

export {
	createSortableDemo,
	createLandingDemo,
	createSharedDemo,
	createPromoDemo,
	createDocsDemo,
	createComboDemo,
	createDraggableDemo,
	createSelectionDemo
};
