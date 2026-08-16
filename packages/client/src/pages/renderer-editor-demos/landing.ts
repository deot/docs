import { action, band, copy, sortableDocument, sortableNode } from './helpers';
import type { RendererDocument } from '@deot/docs-renderer';

/**
 * 落地页模块链：Hero → Features → Steps → FAQ → CTA。
 * @param lang 当前文档语言。
 * @returns 可交给 Combo 或 `$docs.home` 的 V2 文档。
 */
export const createLandingDemo = (lang: string): RendererDocument => sortableDocument(
	copy(lang, '落地页组合', 'Landing composition'),
	[
		sortableNode('hero', {
			eyebrow: copy(lang, '产品首页', 'Product home'),
			title: copy(lang, '用可复用模块拼出完整落地页', 'Compose a complete landing page from reusable modules'),
			description: copy(
				lang,
				'Hero、特性、步骤、问答和行动条已经串好。把 landing 工厂赋给 `$docs.home` 或路由 `content`，再按品牌改文案。',
				'Hero, features, steps, FAQ and CTA are already wired. Assign the landing factory to `$docs.home` or route `content`.'
			),
			align: 'left',
			accent: '#873bf4',
			accentSecondary: '#2d8cf0',
			background: '',
			showVisual: true,
			minHeight: 560,
			highlights: [
				{ value: 'Vue 3', label: copy(lang, '运行时', 'Runtime') },
				{ value: 'i18n', label: copy(lang, '中英切换', 'Locales') },
				{ value: 'V2', label: copy(lang, '扁平文档', 'Flat document') },
				{ value: 'Static', label: copy(lang, '静态发布', 'Static ship') }
			],
			actions: [
				action(copy(lang, '开始搭建', 'Start building')),
				action(copy(lang, '查看基础模块', 'Browse shared modules'), `/${lang}/renderer-editor-demos?name=shared`, 'outline'),
				action(copy(lang, '混合组合', 'Mixed combo'), `/${lang}/renderer-editor-demos?name=combo`, 'outline')
			]
		}, band({ marginBottom: 72 })),
		sortableNode('features', {
			eyebrow: copy(lang, '能力', 'Features'),
			title: copy(lang, '落地页真正用得到的积木', 'The blocks a landing page actually uses'),
			description: copy(
				lang,
				'每张卡片对应一个可复用模块。它们共享同一份 Catalog，首页、文档页和活动页不必各写一套。',
				'Each card maps to a reusable module. Home, docs and campaign pages share one catalog.'
			),
			columns: 3,
			gap: 24,
			accent: '',
			items: [
				{
					title: copy(lang, '流式排版', 'Flow layout'),
					description: copy(lang, 'Sortable Frame 按块堆叠，适合长页和营销叙事。', 'Sortable Frame stacks blocks for long pages and marketing stories.'),
					badge: 'Sortable',
					icon: 'list',
					accent: '#873bf4'
				},
				{
					title: copy(lang, '自由画布', 'Free canvas'),
					description: copy(lang, 'Draggable Frame 管坐标、图层、标尺和吸附。', 'Draggable Frame owns coordinates, layers, rulers and snapping.'),
					badge: 'Draggable',
					icon: 'grid',
					accent: '#2d8cf0'
				},
				{
					title: copy(lang, '同一份文档', 'One document'),
					description: copy(
						lang,
						'V2 扁平 blocks，不写 children，Store 按节点 ID 更新。',
						'V2 flat blocks, no children tree. The store writes by node id.'
					),
					badge: 'Protocol',
					icon: 'file',
					accent: '#14b8a6'
				},
				{
					title: copy(lang, '即时预览', 'Live preview'),
					description: copy(lang, '编辑、撤销和预览弹层共用同一份文档快照。', 'Edit, undo and the preview popup share one document snapshot.'),
					badge: 'Combo',
					icon: 'preview',
					accent: '#f59e0b'
				},
				{
					title: copy(lang, '多语言文案', 'Localized copy'),
					description: copy(lang, '演示工厂按 `lang` 输出中英两套，业务可继续覆盖。', 'Demo factories emit zh/en from `lang`; products can still override.'),
					badge: 'i18n',
					icon: 'notice',
					accent: '#ed4014'
				},
				{
					title: copy(lang, '静态发布', 'Static publish'),
					description: copy(
						lang,
						'开发模式保存 `.page.json`，生产只做导入、导出和预览。',
						'Development writes `.page.json`; production keeps import, export and preview.'
					),
					badge: 'Ship',
					icon: 'upload',
					accent: '#eb2f96'
				}
			]
		}, band({ marginBottom: 88 })),
		sortableNode('steps', {
			eyebrow: copy(lang, '流程', 'Start'),
			title: copy(lang, '四步从空白到上线', 'Four steps from blank to live'),
			description: copy(
				lang,
				'落地页不需要另起仓库。模块、路由和静态资源都走现有文档站点。',
				'A landing page does not need a second repo. Modules, routes and assets stay in this docs site.'
			),
			columns: 4,
			accent: '',
			items: [
				{
					title: copy(lang, '编写', 'Write'),
					description: copy(lang, '从组件库拖入 Hero、Features，或直接改这份演示。', 'Drop Hero and Features, or edit this demo in place.'),
					icon: '1',
					accent: '#873bf4'
				},
				{
					title: copy(lang, '对照', 'Compare'),
					description: copy(lang, '用预览弹层看只读画布，确认间距和强调色。', 'Open the preview popup and check spacing and accents.'),
					icon: '2',
					accent: '#2d8cf0'
				},
				{
					title: copy(lang, '保存', 'Save'),
					description: copy(
						lang,
						'开发模式写出 `.page.json`，也可导出 JSON 交给业务仓库。',
						'Development writes `.page.json`, or export JSON into the product repo.'
					),
					icon: '3',
					accent: '#14b8a6'
				},
				{
					title: copy(lang, '发布', 'Ship'),
					description: copy(lang, '跟文档站一起构建。生产环境仍可导入和预览。', 'Ship with the docs site. Production still imports and previews.'),
					icon: '4',
					accent: '#f59e0b'
				}
			]
		}, band({ marginBottom: 88 })),
		sortableNode('faq', {
			eyebrow: 'FAQ',
			title: copy(lang, '落地页常见问题', 'Landing page questions'),
			description: copy(
				lang,
				'这份演示本身就是可拷贝文档。下面几条覆盖接入、布局和保存。',
				'This demo is itself a copyable document. The answers cover wiring, layout and save.'
			),
			accent: '',
			items: [
				{
					question: copy(lang, '能直接当首页用吗？', 'Can I use this as the home page?'),
					answer: copy(
						lang,
						'可以。把 `createRendererEditorDemoDocument(\'landing\', lang)` 赋给 `$docs.home.locales`，或把保存后的 `.page.json` 配到 `home.locales`。',
						'Yes. Assign `createRendererEditorDemoDocument(\'landing\', lang)` to `$docs.home.locales`, or point `home.locales` at the saved `.page.json`.'
					)
				},
				{
					question: copy(lang, '切换到自由布局会丢块吗？', 'Will switching to a free canvas drop blocks?'),
					answer: copy(
						lang,
						'落地模块现在同时声明 draggable；只有 `space` 仍是 Sortable 专属。切换后会按模块默认尺寸生成坐标。',
						'Landing modules now declare draggable; only `space` stays sortable-only. Switching assigns default placements.'
					)
				},
				{
					question: copy(lang, '强调色要写在每个模块里吗？', 'Do I set the accent on every module?'),
					answer: copy(
						lang,
						'Hero 和 CTA 有独立 accent；Features / Steps 可以给单卡填 accent，留空则按调色板轮换。',
						'Hero and CTA have their own accent. Features / Steps accept per-card accents, or rotate the palette when empty.'
					)
				},
				{
					question: copy(lang, '按钮能跳到其它演示吗？', 'Can buttons open other demos?'),
					answer: copy(
						lang,
						'可以。`to` 写成 `/${lang}/renderer-editor-demos?name=shared` 即可，和业务路由一样走 Vue Router。',
						'Yes. Set `to` to `/${lang}/renderer-editor-demos?name=shared`. It uses Vue Router like product routes.'
					)
				},
				{
					question: copy(lang, '生产环境还能保存吗？', 'Can I save in production?'),
					answer: copy(
						lang,
						'不能写回工作区。生产仍可撤销、预览、导入和导出；保存只在 development 调用 `/__docs/page`。',
						'Not back to the workspace. Production still undoes, previews, imports and exports; save hits `/__docs/page` only in development.'
					)
				},
				{
					question: copy(lang, '如何换成自己的模块？', 'How do I swap in my own modules?'),
					answer: copy(
						lang,
						'通过 `$docs.renderers` 注册业务模块。不要占用 `docs:` 前缀。落地模块可以和 Banner、表单混排。',
						'Register product modules on `$docs.renderers`. Do not use the `docs:` prefix. Landing blocks can sit next to banners and forms.'
					)
				}
			]
		}, band({ marginBottom: 88 })),
		sortableNode('cta', {
			eyebrow: copy(lang, '下一步', 'Next'),
			title: copy(lang, '把这份组合带到业务页', 'Take this composition into a product page'),
			description: copy(
				lang,
				'保存会写出 `.page.json`。也可以继续改模块顺序，或打开混合组合看 Markdown 和广告位怎么插进来。',
				'Save writes `.page.json`. Keep rearranging modules, or open the mixed combo to see Markdown and ads in the same flow.'
			),
			align: 'center',
			accent: '#873bf4',
			accentSecondary: '#2d8cf0',
			background: '',
			actions: [
				action(copy(lang, '返回演示目录', 'Back to catalog'), `/${lang}/renderer-editor-demos`),
				action(copy(lang, '打开混合组合', 'Open mixed combo'), `/${lang}/renderer-editor-demos?name=combo`, 'outline')
			]
		}, band({ marginBottom: 0 }))
	]
);
