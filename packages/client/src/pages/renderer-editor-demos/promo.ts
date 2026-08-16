import { band, copy, heading, paragraph, picture, sortableDocument, sortableNode } from './helpers';
import type { RendererDocument } from '@deot/docs-renderer';

const item = (title: string, src: string, href = 'https://example.com') => ({
	src,
	href,
	title,
	alt: title
});

/**
 * 广告位四种样式：tile banner / scroll card / poster / notice。
 * 模块 type 仍是 `ads`。
 * @param lang 当前文档语言。
 * @returns 可对照广告样式的 V2 文档。
 */
export const createPromoDemo = (lang: string): RendererDocument => sortableDocument(
	copy(lang, '广告位样式', 'Promo placements'),
	[
		sortableNode('title', heading(copy(lang, '广告位（type: ads）', 'Ads module (type: ads)'), 1, 36), {
			marginBottom: 8
		}),
		sortableNode('text', paragraph(copy(
			lang,
			'目录在 `modules/sortable/promo`，避免 URL 含 `/ads/` 被拦截。模块 type 仍是 `ads`。下面四种样式共用一份 items：图片、标题和跳转。',
			'Lives in `modules/sortable/promo` so URLs avoid `/ads/` blockers. The module type stays `ads`. The four styles share the same items: image, title and href.'
		))),
		sortableNode('title', heading(copy(lang, '横幅 Banner', 'Banner tiles'), 2, 24), { marginBottom: 8 }),
		sortableNode('text', paragraph(copy(
			lang,
			'`layout: tile` + `style: banner` 适合页顶或章节之间的双栏推广。缺图时会用标题首字做回退。',
			'`layout: tile` + `style: banner` fits a two-column promo between sections. Missing images fall back to the title initial.'
		), 15)),
		sortableNode('ads', {
			layout: 'tile',
			style: 'banner',
			columns: 2,
			gap: 16,
			height: 180,
			speed: 4,
			items: [
				item(copy(lang, '春季文档主题', 'Spring docs theme'), picture(copy(lang, '春季主题', 'Spring'), 960, 360, '456cf6')),
				item(copy(lang, '组件库更新', 'Component updates'), picture(copy(lang, '组件库', 'Components'), 960, 360, '873bf4')),
				item(copy(lang, '静态托管指南', 'Static hosting guide'), picture(copy(lang, '静态托管', 'Hosting'), 960, 360, '2d8cf0')),
				item(copy(lang, '搜索与预取', 'Search and prefetch'), picture(copy(lang, '搜索', 'Search'), 960, 360, '14b8a6'))
			]
		}, band()),
		sortableNode('title', heading(copy(lang, '滚动卡片', 'Scrolling cards'), 2, 24), { marginBottom: 8 }),
		sortableNode('text', paragraph(copy(
			lang,
			'`layout: scroll` 会复制一份轨道做无缝循环。卡片多于一列时更明显，速度用 `speed` 控制。',
			'`layout: scroll` clones the track for a seamless loop. It reads better with more than one card; `speed` controls the motion.'
		), 15)),
		sortableNode('ads', {
			layout: 'scroll',
			style: 'card',
			columns: 3,
			gap: 16,
			height: 200,
			speed: 6,
			items: [
				item(copy(lang, 'Hero 模板', 'Hero template'), picture('Hero', 640, 400, '873bf4')),
				item(copy(lang, 'FAQ 模板', 'FAQ template'), picture('FAQ', 640, 400, '2d8cf0')),
				item(copy(lang, 'CTA 模板', 'CTA template'), picture('CTA', 640, 400, '14b8a6')),
				item(copy(lang, '广告横幅', 'Ad banner'), picture('Ads', 640, 400, 'ed6a0c')),
				item(copy(lang, '自由画布', 'Free canvas'), picture('Canvas', 640, 400, 'f5a623')),
				item(copy(lang, '组合框', 'Selection group'), picture('Group', 640, 400, '13c2c2'))
			]
		}, band()),
		sortableNode('title', heading(copy(lang, '海报 Poster', 'Poster tiles'), 2, 24), { marginBottom: 8 }),
		sortableNode('text', paragraph(copy(
			lang,
			'海报更高，适合活动封面和版本发布。两列时注意标题不要太长，否则会压住图片。',
			'Posters are taller, for campaign covers and release art. Keep titles short in two columns so they do not cover the image.'
		), 15)),
		sortableNode('ads', {
			layout: 'tile',
			style: 'poster',
			columns: 2,
			gap: 16,
			height: 260,
			speed: 4,
			items: [
				item(copy(lang, '1.0 发布海报', '1.0 release poster'), picture('1.0', 800, 520, '456cf6')),
				item(copy(lang, '主题工坊', 'Theme workshop'), picture(copy(lang, '主题', 'Theme'), 800, 520, 'c23bd6')),
				item(copy(lang, '编辑器演示', 'Editor demos'), picture('Demos', 800, 520, '873bf4')),
				item(copy(lang, '贡献指南', 'Contributing guide'), picture(copy(lang, '贡献', 'Contribute'), 800, 520, '19be6b'))
			]
		}, band()),
		sortableNode('title', heading(copy(lang, '通知条 Notice', 'Notice strip'), 2, 24), { marginBottom: 8 }),
		sortableNode('text', paragraph(copy(
			lang,
			'通知条可以只有标题。用来放版本提示、维护公告或文档迁移说明。',
			'A notice can be title-only. Use it for version notes, maintenance banners or migration hints.'
		), 15)),
		sortableNode('ads', {
			layout: 'tile',
			style: 'notice',
			columns: 1,
			gap: 8,
			height: 88,
			speed: 4,
			items: [
				item(copy(lang, '通知：Renderer 演示已改为 /renderer-editor-demos', 'Notice: demos now live at /renderer-editor-demos'), ''),
				item(copy(lang, '维护：开发模式保存会写回 ./pages/*.page.json', 'Maintenance: development save writes ./pages/*.page.json'), ''),
				item(copy(lang, '提示：广告链接只允许 http(s) 与站内路径', 'Hint: ad hrefs allow http(s) and in-site paths only'), '')
			]
		}, band({ marginBottom: 0 }))
	]
);
