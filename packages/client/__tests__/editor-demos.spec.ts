import { RENDERER_SORTABLE_CONTENT_WIDTH, validateRendererDocument } from '@deot/docs-renderer';
import {
	RENDERER_EDITOR_DEMOS,
	createRendererEditorDemoDocument,
	isRendererEditorDemo,
	listRendererEditorDemos,
	rendererEditorDemoPath
} from '../src/pages/renderer-editor-demos/catalog';
import { appearance, band, picture } from '../src/pages/renderer-editor-demos/helpers';

const isSortableBlock = (
	block: { appearance?: { fullWidth?: boolean; maxWidth?: number } }
): block is { appearance: { fullWidth: boolean; maxWidth: number }; module: { type: string } } => (
	typeof block.appearance?.fullWidth === 'boolean' && typeof block.appearance.maxWidth === 'number'
);

describe('renderer editor demos', () => {
	it('exposes a stable demo catalog and valid documents', () => {
		expect(RENDERER_EDITOR_DEMOS).toEqual([
			'sortable', 'landing', 'shared', 'promo', 'docs', 'combo', 'draggable', 'selection'
		]);
		expect(isRendererEditorDemo('landing')).toBe(true);
		expect(isRendererEditorDemo('missing')).toBe(false);
		expect(rendererEditorDemoPath('zh-CN')).toBe('/zh-CN/renderer-editor-demos');
		expect(rendererEditorDemoPath('zh-CN', 'promo')).toBe('/zh-CN/renderer-editor-demos?name=promo');
		expect(picture('ads', 1152, 648, '456cf6', 'fff'))
			.toBe('https://dummyimage.com/1152x648/456cf6/fff/?text=ads');
		expect(listRendererEditorDemos('zh-CN').map(item => item.name)).toEqual(RENDERER_EDITOR_DEMOS);
		expect(listRendererEditorDemos('en-US').find(item => item.name === 'landing')).toMatchObject({
			title: 'Landing composition',
			modules: ['hero', 'features', 'steps', 'faq', 'cta'],
			accent: '#873bf4'
		});

		for (const demo of RENDERER_EDITOR_DEMOS) {
			const zh = createRendererEditorDemoDocument(demo, 'zh-CN');
			const en = createRendererEditorDemoDocument(demo, 'en-US');
			expect(validateRendererDocument(zh).valid).toBe(true);
			expect(validateRendererDocument(en).valid).toBe(true);
			expect(zh.meta.title).toBeTruthy();
			expect(en.meta.title).toBeTruthy();
			expect(zh.blocks.length).toBeGreaterThan(0);
		}

		const landing = createRendererEditorDemoDocument('landing', 'en-US');
		expect(landing.layout.mode).toBe('sortable');
		expect(landing.blocks.map(block => block.module.type)).toEqual([
			'hero', 'features', 'steps', 'faq', 'cta'
		]);
		expect(landing.blocks.filter(block => ['hero', 'cta'].includes(block.module.type))
			.map(block => block.module.type)).toEqual(['hero', 'cta']);
		const selection = createRendererEditorDemoDocument('selection', 'en-US');
		expect(selection.layout.mode).toBe('draggable');
		expect(selection.blocks.some(block => block.module.type === 'selection')).toBe(true);
	});

	it('writes explicit fill and content width on sortable demos', () => {
		expect(appearance()).toMatchObject({
			fullWidth: false,
			maxWidth: RENDERER_SORTABLE_CONTENT_WIDTH
		});
		expect(band({ marginBottom: 8 })).toMatchObject({
			fullWidth: true,
			maxWidth: RENDERER_SORTABLE_CONTENT_WIDTH,
			marginBottom: 8
		});

		const landing = createRendererEditorDemoDocument('landing', 'en-US');
		expect(landing.blocks.every(block => (
			isSortableBlock(block)
			&& block.appearance.fullWidth === true
			&& block.appearance.maxWidth === RENDERER_SORTABLE_CONTENT_WIDTH
		))).toBe(true);

		for (const name of ['sortable', 'shared', 'docs'] as const) {
			const document = createRendererEditorDemoDocument(name, 'en-US');
			expect(document.layout.mode).toBe('sortable');
			expect(document.blocks.every(block => (
				isSortableBlock(block)
				&& block.appearance.fullWidth === false
				&& block.appearance.maxWidth === RENDERER_SORTABLE_CONTENT_WIDTH
			))).toBe(true);
		}

		const combo = createRendererEditorDemoDocument('combo', 'en-US');
		for (const block of combo.blocks) {
			expect(isSortableBlock(block)).toBe(true);
			if (!isSortableBlock(block)) continue;
			expect(block.appearance.maxWidth).toBe(RENDERER_SORTABLE_CONTENT_WIDTH);
			expect(block.appearance.fullWidth).toBe(['hero', 'cta', 'ads'].includes(block.module.type));
		}

		const promo = createRendererEditorDemoDocument('promo', 'en-US');
		for (const block of promo.blocks) {
			expect(isSortableBlock(block)).toBe(true);
			if (!isSortableBlock(block)) continue;
			expect(block.appearance.maxWidth).toBe(RENDERER_SORTABLE_CONTENT_WIDTH);
			expect(block.appearance.fullWidth).toBe(block.module.type === 'ads');
		}
	});
});
