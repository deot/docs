import { copy, sortableDocument, sortableNode } from './helpers';
import type { RendererDocument } from '@deot/docs-renderer';

/**
 * Client 文档模块：内联 Markdown + 远程 SFC 占位。
 * @param lang 当前文档语言。
 * @returns 含 `docs:markdown` 与 `docs:sfc` 的文档。
 */
export const createDocsDemo = (lang: string): RendererDocument => {
	const overview = copy(
		lang,
		[
			'# docs:markdown',
			'',
			'这个块用内联 `content`，不依赖 `.md` 文件。业务路由也可以把 `content` 直接设成 Renderer 文档；需要文件时改成 `{ source: \'./guide.md\' }`。',
			'',
			'## 和落地模块混排',
			'',
			'Markdown 可以插在 Hero、Features、广告位之间。它走文档站点同一套高亮、标题锚点和提示容器。',
			'',
			'- 内联 `content` 适合短说明和演示',
			'- `source` 可以是站点路径或 `https://` 地址，走 Gateway 缓存和热更新',
			'- `options.indicator` 控制文档指示器，后续渲染选项也放在 `options`',
			'- 演示文档显式写成不铺满 + 1200；实例未写 `maxWidth` 时正文会跟着容器铺开',
			'- 通栏时写 `fullWidth: true` 并保留 `maxWidth: 1200`',
			'- 不要把整本手册塞进一个块，必要时拆成多个 `docs:markdown`',
			'',
			'## 代码与提示',
			'',
			'```ts',
			'window.$docs = {',
			'  routes: {',
			'    \'/guide\': { content: { schemaVersion: 2, meta: { id: \'guide\', title: \'Guide\' }, layout: { mode: \'sortable\' }, blocks: [] } }',
			'  }',
			'}',
			'```',
			'',
			':::tip',
			'开发模式从 Header 进入编辑器后，保存会把内联文档写成 `.page.json`，并回写 `home.locales`。',
			':::',
			'',
			':::warning',
			'`docs:` 前缀留给 Client。业务模块不要注册 `docs:markdown` 或 `docs:sfc`。',
			':::'
		].join('\n'),
		[
			'# docs:markdown',
			'',
			'This block uses inline `content` and does not need a `.md` file. Routes can also set `content` to a Renderer document; switch to `{ source: \'./guide.md\' }` for a file.',
			'',
			'## Mix with landing modules',
			'',
			'Markdown can sit between Hero, Features and ads. It uses the same highlighting, heading anchors and callout containers as the docs site.',
			'',
			'- Inline `content` fits short notes and demos',
			'- `source` can be a site path or `https://` URL, with Gateway cache and hot reload',
			'- `options.indicator` toggles the document map; later renderer flags also go under `options`',
			'- Demos write boxed 1200 explicitly; unset `maxWidth` follows the container',
			'- Use `fullWidth: true` with `maxWidth: 1200` for a bleed',
			'- Do not dump a whole manual into one block; split into several `docs:markdown` nodes',
			'',
			'## Code and callouts',
			'',
			'```ts',
			'window.$docs = {',
			'  routes: {',
			'    \'/guide\': { content: { schemaVersion: 2, meta: { id: \'guide\', title: \'Guide\' }, layout: { mode: \'sortable\' }, blocks: [] } }',
			'  }',
			'}',
			'```',
			'',
			':::tip',
			'In development, saving from the header editor writes an inline document to `.page.json` and updates `home.locales`.',
			':::',
			'',
			':::warning',
			'The `docs:` prefix is reserved for Client. Product modules must not register `docs:markdown` or `docs:sfc`.',
			':::'
		].join('\n')
	);
	const sfcNote = copy(
		lang,
		[
			'## docs:sfc',
			'',
			'下一个块指向 `./examples/renderer-demo.vue`。远程 SFC 由 Gateway 拉取，失败时会显示错误而不是空白。',
			'',
			'1. `source` 不能为空',
			'2. 相对路径相对当前语言目录',
			'3. 预览里的跳转仍走文档 Router',
			'',
			'> 若只要静态说明，优先用 `docs:markdown`；SFC 留给需要交互的示例。'
		].join('\n'),
		[
			'## docs:sfc',
			'',
			'The next block points at `./examples/renderer-demo.vue`. Remote SFCs load through Gateway and show an error instead of a blank frame.',
			'',
			'1. `source` is required',
			'2. Relative paths are resolved from the current language directory',
			'3. Links inside the preview still use the docs router',
			'',
			'> Prefer `docs:markdown` for static notes. Keep SFC for interactive examples.'
		].join('\n')
	);
	return sortableDocument(
		copy(lang, '文档模块', 'Docs modules'),
		[
			sortableNode('docs:markdown', { content: overview }),
			sortableNode('docs:markdown', { content: sfcNote }),
			sortableNode('docs:sfc', {
				source: './examples/renderer-demo.vue'
			}, { marginBottom: 0 })
		]
	);
};
