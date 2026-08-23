import { action, band, copy, picture, sortableDocument, sortableNode } from './helpers';
import type { RendererDocument } from '@deot/docs-renderer';

/**
 * 落地模块 + 广告位 + Markdown 的混排参考。
 * @param lang 当前文档语言。
 * @returns 可交给 Combo 的混合文档。
 */
export const createComboDemo = (lang: string): RendererDocument => sortableDocument(
	copy(lang, '混合组合', 'Mixed composition'),
	[
		sortableNode('hero', {
			eyebrow: copy(lang, '组合页', 'Combo page'),
			title: copy(lang, '落地模块、文档块和广告位放在同一画布', 'Landing blocks, docs and ads on one canvas'),
			description: copy(
				lang,
				'业务页经常是 Hero 后面直接接 Markdown，再夹一条赞助位。这份演示按这个顺序排好，按钮可以跳到落地页对照。',
				'Product pages often put Markdown right after Hero, then a sponsor strip. This demo follows that order; the button opens the landing reference.'
			),
			align: 'left',
			accent: '#873bf4',
			accentSecondary: '#2d8cf0',
			background: '',
			showVisual: true,
			minHeight: 480,
			highlights: [
				{ value: 'Hero', label: copy(lang, '首屏', 'Opening') },
				{ value: 'MD', label: copy(lang, '文档块', 'Docs block') },
				{ value: 'Ads', label: copy(lang, '赞助位', 'Sponsor') },
				{ value: 'CTA', label: copy(lang, '收束', 'Close') }
			],
			actions: [
				action(copy(lang, '打开落地页演示', 'Open landing demo'), `/${lang}/renderer-editor-demos?name=landing`),
				action(copy(lang, '打开广告位', 'Open promo'), `/${lang}/renderer-editor-demos?name=promo`, 'outline')
			]
		}, band({ marginBottom: 48 })),
		sortableNode('docs:markdown', {
			content: copy(
				lang,
				[
					'## 文档插入点',
					'',
					'`docs:markdown` 可以插在任意内置模块之间。这里放产品说明、版本差异或一段带代码的接入示例。',
					'',
					'- 短说明用内联 `content`',
					'- 长文档用 `{ source: \'./guide.md\' }` 或 https 地址',
					'- `{ options: { indicator: false } }` 可关掉文档指示器',
					'- 需要交互示例时换成 `docs:sfc`',
					'',
					'```js',
					'content: createRendererEditorDemoDocument(\'combo\', lang)',
					'```',
					'',
					':::tip',
					'混排时 Hero / CTA / 广告位铺满画布、正文 1200；Markdown 与 Features 不铺满、整块 1200 居中。',
					':::'
				].join('\n'),
				[
					'## Docs insertion',
					'',
					'`docs:markdown` can sit between any built-in modules. Use it for product notes, changelog or a short integration snippet.',
					'',
					'- Inline `content` for short notes',
					'- `{ source: \'./guide.md\' }` or an https URL for long guides',
					'- `{ options: { indicator: false } }` hides the document map',
					'- `docs:sfc` when the example must be interactive',
					'',
					'```js',
					'content: createRendererEditorDemoDocument(\'combo\', lang)',
					'```',
					'',
					':::tip',
					'Hero, CTA and ads fill the canvas with 1200px content. Markdown and Features stay boxed at 1200.',
					':::'
				].join('\n')
			)
		}),
		sortableNode('features', {
			eyebrow: copy(lang, '对照', 'Reference'),
			title: copy(lang, '复制时保留的结构', 'Keep this structure when copying'),
			description: copy(
				lang,
				'Combo 是编辑器壳，Renderer 是只读画布。首页用 Renderer，装修页用 Combo，模块表必须是同一份。',
				'Combo is the editor shell; Renderer is the read-only canvas. Home uses Renderer, the editor uses Combo, and both must share one module table.'
			),
			columns: 2,
			gap: 20,
			accent: '',
			items: [
				{
					title: 'Combo',
					description: copy(lang, '编辑器壳：撤销、预览、保存、导入导出。', 'Editor shell: undo, preview, save, import and export.'),
					badge: 'API',
					icon: 'edit',
					accent: '#873bf4'
				},
				{
					title: 'Renderer',
					description: copy(lang, '只读画布：首页和内容页直接挂文档。', 'Read-only canvas: home and content pages mount the document.'),
					badge: 'API',
					icon: 'visible',
					accent: '#2d8cf0'
				},
				{
					title: 'docs:markdown',
					description: copy(lang, '内联或文件 Markdown，可插在营销模块之间。', 'Inline or file Markdown between marketing modules.'),
					badge: 'Docs',
					icon: 'file',
					accent: '#14b8a6'
				},
				{
					title: 'ads',
					description: copy(lang, '赞助位和通知条。目录叫 promo，type 仍是 ads。', 'Sponsors and notices. Folder is promo; type stays ads.'),
					badge: 'Promo',
					icon: 'activity',
					accent: '#f59e0b'
				}
			]
		}),
		sortableNode('ads', {
			layout: 'tile',
			style: 'banner',
			columns: 2,
			gap: 16,
			height: 160,
			speed: 4,
			items: [
				{
					src: picture(copy(lang, '主题与组件', 'Theme'), 960, 320, '873bf4'),
					href: 'https://example.com',
					title: copy(lang, '赞助：主题与组件', 'Sponsor: theme and components'),
					alt: copy(lang, '主题与组件', 'Theme and components')
				},
				{
					src: picture(copy(lang, '静态托管', 'Hosting'), 960, 320, '2d8cf0'),
					href: 'https://example.com',
					title: copy(lang, '赞助：静态托管', 'Sponsor: static hosting'),
					alt: copy(lang, '静态托管', 'Static hosting')
				}
			]
		}, band()),
		sortableNode('faq', {
			eyebrow: 'FAQ',
			title: copy(lang, '混排时要注意什么', 'What to watch when mixing'),
			description: copy(
				lang,
				'营销模块和文档块共用一条流，间距靠 appearance，不要靠空 Text 撑开。',
				'Marketing and docs share one flow. Use appearance for gaps, not empty Text.'
			),
			accent: '',
			items: [
				{
					question: copy(lang, 'Markdown 会不会打乱强调色？', 'Will Markdown reset the accent?'),
					answer: copy(
						lang,
						'不会。Markdown 用文档主题色；Hero / CTA / Features 仍用自己的 accent。',
						'No. Markdown uses the docs theme; Hero / CTA / Features keep their own accents.'
					)
				},
				{
					question: copy(lang, '广告位必须有图吗？', 'Do ads require an image?'),
					answer: copy(
						lang,
						'图片和标题至少要有一项。通知条可以只有标题；横幅和海报建议给图。',
						'Provide an image or a title. Notices can be title-only; banners and posters should have images.'
					)
				}
			]
		}),
		sortableNode('cta', {
			eyebrow: copy(lang, '收束', 'Close'),
			title: copy(lang, '同一套模块表供给首页和内容页', 'One module table for home and content pages'),
			description: copy(
				lang,
				'把这份文档交给 `routes[\'/\'].content` 或其它路由 `content`。需要纯落地页时打开 landing，需要纯文档块时打开 docs。',
				'Hand this document to `routes[\'/\'].content` or another route `content`. Open landing for a pure marketing page, or docs for document blocks only.'
			),
			align: 'center',
			accent: '#873bf4',
			accentSecondary: '#2d8cf0',
			background: '',
			actions: [
				action(copy(lang, '返回目录', 'Back to catalog'), `/${lang}/renderer-editor-demos`),
				action(copy(lang, '打开文档模块', 'Open docs modules'), `/${lang}/renderer-editor-demos?name=docs`, 'outline')
			]
		}, band({ marginBottom: 0 }))
	]
);
