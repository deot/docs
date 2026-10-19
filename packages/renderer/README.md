# @deot/docs-renderer

`@deot/docs-renderer` 同时提供只读 `Renderer` 与可视化装修 `Combo`。两者共享
扁平页面文档协议、模块定义和校验流程，但每个实例都有自己的 Module Catalog，
不会通过全局注册表互相污染。

## 安装

```bash
pnpm add @deot/docs-renderer @deot/docs-locale @deot/vc vue
```

宿主还需要加载 `@deot/docs-renderer/dist/index.style.css`，以及 `@deot/vc-components` 的组件样式。

## 文档结构

上下排序与自由布局是两种独立 Frame，节点不能混用 `appearance` 和 `placement`：

```ts
const document = {
	schemaVersion: 2,
	meta: { id: 'home', title: 'Home' },
	layout: {
		mode: 'sortable',
		maxWidth: 1920,
		background: '#fff'
	},
	blocks: [{
		id: 'hero',
		module: {
			type: 'hero',
			version: 1,
			props: { title: 'Hello' }
		},
		appearance: {
			marginTop: 0,
			marginBottom: 24,
			paddingTop: 0,
			paddingRight: 0,
			paddingBottom: 0,
			paddingLeft: 0,
			fullWidth: true,
			maxWidth: 1200
		}
	}]
};
```

`blocks` 始终是扁平数组，不支持 `children`。`sortable` 使用自然文档流：
`layout.maxWidth` 是画布宽度（默认 1920）。发布页画布随实际容器铺开；Combo
按该宽度绘制画板。

排序页面还支持可选的 `layout.contentWidth`（正文区域最大宽度，省略或 `0` 为不限）
和 `layout.sidePattern`（两侧淡斜纹，默认关闭）。两者在页面属性中可编辑；斜纹在
不超过 760px 的容器中自动收起。正文区域内的 `fullWidth` 模块铺满该区域，模块自身
的 `appearance.maxWidth` 仍控制内容宽度。旧文档无需增加这些字段。

每个模块用 `appearance.fullWidth` 决定外框是否拉满画布，用 `appearance.maxWidth`
限制正文宽。`0` 与未填写等价，渲染时都不限制，也不会回退到模块
`capability.maxWidth`。`frames.sortable.fullWidth / maxWidth` 只用于**新建节点**：
未铺满模块默认写入 1200，铺满模块（Hero / CTA）默认不写最大宽。

`draggable` 使用包含 `x/y/width/height/rotate/zIndex` 的绝对几何信息，任意角度
均可通过八方向控制点缩放。

页面属性写在 `document.layout`，不会作为 Widget 节点进入 `blocks`。`selection`
是画布组合框，同样不出现在 Widget。

## 内置模块

未传 `modules` 时使用 `BuiltinModules`。模块 `type` 与源码目录不必同名：

| type | 目录 | Widget | 说明 |
| --- | --- | --- | --- |
| `page` | `modules/shared/page` | 否 | 页面 `layout`；失焦后在 Inspector 编辑 |
| `selection` | `modules/shared/selection` | 否 | 画布组合框 |
| `space` | `modules/sortable/space` | 是 | 间距 |
| `title` | `modules/shared/title` | 是 | 标题 |
| `text` | `modules/shared/text` | 是 | 正文 |
| `list` | `modules/shared/list` | 是 | 列表 |
| `image` | `modules/shared/image` | 是 | 图片 |
| `area` | `modules/sortable/area` | 是 | 图片热区 |
| `actions` | `modules/shared/actions` | 是 | 操作区 |
| `hero` | `modules/sortable/hero` | 是 | 首屏 |
| `code` | `modules/sortable/code` | 是 | 代码展示、折叠、复制 |
| `features` | `modules/sortable/features` | 是 | 特性 |
| `steps` | `modules/sortable/steps` | 是 | 步骤 |
| `faq` | `modules/sortable/faq` | 是 | 问答 |
| `cta` | `modules/sortable/cta` | 是 | 行动条 |
| `ads` | `modules/sortable/promo` | 是 | 广告位；目录名避开路径中的 `/ads/` 拦截 |

`title` / `text` / `list` / `image` / `actions` 与双 Frame 内容模块同属 `modules/shared`。
当前没有仅自由布局可用的内置模块。

`features` / `steps` / `faq` / `cta` 的 `align` 支持 `left`、`center`、`right`，
默认 `center`，同时控制标题和下方内容的对齐；标题与正文始终上下排列。
居中布局维持紧凑比例：特性卡片、步骤和问答分别收在居中的内容区域内。
左／右对齐在宽屏采用通栏分格：特性卡片搭配淡彩图示、步骤置于共享底色、问答分为三列。
窄屏恢复单列。居中和窄屏问答默认展开第一项，宽屏左／右布局默认全部展开，仍可独立折叠。

`features.items[].image` 可配置卡片下方的图片，支持 workspace 相对路径、URL 和 base64；
编辑器支持填写地址或上传图片。留空时，左／右布局使用默认轻图示，居中布局保持简洁卡片。

Hero、CTA、Features、Steps 新建及新增条目时，强调色默认留空以继承站点主题。优先级为条目/按钮显式颜色 → block 强调色 → 站点语义色 → 内置值；已有文档的显式颜色保留。`accent` 对应 `--docs-color-primary`，`accentSecondary` 对应 `--docs-color-secondary`；实心按钮文字默认使用 `--docs-foreground-color-on-primary`，仍可通过 `textColor` 覆盖。站点配置方式及 CSS / SCSS 变量迁移表见 [Theme 文档](../theme/README.md)。

Hero、CTA、Features、Steps、FAQ、Code 的 `description`、Features / Steps 条目的 `description`、FAQ 条目的 `answer`，以及 Text 模块的 `text`，均按纯文本渲染并保留 `\n` 换行，同时支持自动折行；不解析 `<br>` 等 HTML 标签。

`hero` 默认左侧文字、右侧文档面板；居中或居右时上下排列。
保留 `showVisual` 开关，并支持可选的 `visual` 配置（旧数据使用默认文档）：

```json
{
  "visual": {
    "type": "code",
    "title": "home.tsx",
    "content": "const page = { schemaVersion: 2 };",
    "language": "typescript"
  }
}
```

`type` 可为 `markdown` 或 `code`。Markdown 支持常用语法，禁用原始 HTML；
代码内置 JavaScript、TypeScript、JSON、HTML/XML、CSS 和 Bash 高亮，其他语言按纯文本展示。
面板类型、标题、内容、代码语言均可在编辑器中修改。文档和代码区域使用 `Scroller` 虚拟滚动条。
只读页面启用轻动效，遵循系统减少动态效果设置。

`code` 用于独立展示代码，标题与代码始终上下排列，`align` 默认 `center`，也支持 `left` / `right`。
使用 `filename`、`language`、`content` 设置文件名、语言和完整源码；支持的高亮语言与 Hero 相同，其他语言安全转义为纯文本。
代码区域使用 `Scroller` 虚拟滚动条，手机端自动换行。复制始终包含完整源码，包括折叠内容。

```json
{
  "filename": "index.html",
  "language": "html",
  "content": "<main>\n  <h1>Hello, docs!</h1>\n</main>",
  "accent": "",
  "background": "",
  "textColor": "",
  "folds": [{ "start": 2, "end": 2, "label": "页面内容" }],
  "highlightLines": [1, 3]
}
```

`folds` 的行号从 1 开始，包含首尾两行，区间不能重叠或超出源码范围；默认折叠，可展开查看完整代码。
`highlightLines` 指定重点行。上述字段均可在编辑器修改。
`accent` 留空跟随站点主题色，语法高亮、按钮、淡彩底和边框由它派生，深色模式适度提亮以保持可读；
`background` / `textColor` 留空适配站点明暗主题，也可单独设置代码面板底色与文字色。

与 `@deot/docs-client` 一起使用时，`docs:` 前缀留给 Client 的 `docs:markdown` 与
`docs:sfc`，不要在 `$docs.renderers` 里注册同名前缀。

## 使用

```vue
<Renderer :document="document" :modules="modules" />
<Combo v-model="document" :modules="modules" @save="handleSave" />
```

`Renderer` 的 `after` 插槽用于宿主页尾。排序页面将它放在正文之后，并纳入正文
宽度和两侧斜纹；自由布局将它放在缩放画布之外。

未传 `modules` 时使用 `BuiltinModules`；一旦显式传入，传入数组就是该实例的完整
模块范围，不会隐式混入内置模块。

`Combo` 接受 `context`（`locale`、`theme` 等）、`historyLimit` 和 `draftKey`。
传入 `draftKey` 时，草稿写入 IndexedDB 库 `deot-docs-renderer`，与站点 Gateway
的 `deot-docs` 分库，避免清缓存误删未发布页面。

| 事件 | 说明 |
| --- | --- |
| `update:modelValue` / `change` | 文档变更。 |
| `save` | 工具栏保存；宿主负责持久化。 |
| `back` | 工具栏返回。 |
| `error` | 校验失败时给出 `issues`。 |

实例方法：`undo`、`redo`、`validate`、`preview`、`save`、`getDocument`、
`importDocument`、`exportDocument`、`select`、`clearDraft`。根入口不公开 Preview
组件；预览由 Combo 内部弹层完成。

Inspector 在选中模块时编辑该模块；**失焦后才展示页面属性**（`document.layout`）。

## 自定义模块

```ts
import { defineRendererModule } from '@deot/docs-renderer';

export const BannerModule = defineRendererModule({
	identity: {
		type: 'company:banner',
		version: 1,
		label: 'Banner',
		category: 'Company'
	},
	widget: {
		visible: true,
		presets: [{ key: 'default', label: 'Default banner' }]
	},
	data: {
		create: () => ({ title: '' })
	},
	viewer: BannerViewer,
	editor: BannerEditor,
	frames: {
		sortable: { movable: true, deletable: true },
		draggable: {
			initialPlacement: () => ({
				x: 0,
				y: 0,
				width: 320,
				height: 160,
				rotate: 0,
				zIndex: 1
			})
		}
	}
});
```

Widget 只发出创建意图，Viewer 只读，Editor 通过 `update:modelValue` 提交不可变
属性；所有文档写入都由 Combo 的实例 Store 完成。

根入口公开 `Combo`、`Renderer`、`BuiltinModules`、`defineRendererModule`、协议
类型和校验工具，不公开全局可变 Registry 或重复的 Preview 组件。

## JSON 编辑

Combo 的 JSON 树与源码视图共用同一套字段策略：键名和值类型从一开始就按协议锁定；
只有数组可以增删元素。`schemaVersion` 与 `layout.mode` 的值不可改。源码粘贴仍会
经过 `validateRendererDocument`。

## 公共导出

| 导出 | 说明 |
| --- | --- |
| `Combo` / `Renderer` | 可视化编辑器与只读渲染器。 |
| `BuiltinModules` | 内置模块表。 |
| `defineRendererModule` / `createRendererModuleCatalog` | 定义模块、创建实例级 Catalog。 |
| `RendererModuleCatalog` | 实例级模块目录类。 |
| `createEmptyRendererDocument` / `prepareRendererDocument` / `validateRendererDocument` | 空文档、规范化与校验。 |
| `createRendererLayout` | 创建默认 `layout` 对象。 |
| `convertRendererDocumentFrame` | 在 `sortable` 与 `draggable` 布局间迁移文档。 |
| `createRendererId` | 生成模块或节点 ID。 |
| `createRendererPageNode` / `createRendererSelectionNode` | 页面与组合框辅助函数。 |
| `cloneRendererValue` | 深拷贝协议值。 |

同时导出页面协议类型与画布宽度常量。站点接入、`.page.json` 保存和 `docs:` 模块见
[`@deot/docs-client`](../client/README.md) 与 [`@deot/docs-dever`](../dever/README.md)。

## 包内目录

目录语义对齐 `wya-vm.next` 的 Combo / Frame / Widget / Editor，协议文件留在包根：

```text
src/
├── index.ts
├── types.ts               # 页面协议
├── catalog.ts             # 实例级 Module Catalog
├── document.ts            # 空文档、Frame 迁移、插入边界
├── validate.ts
├── combo/                 # 完整编辑器
├── assist/renderer|preview
├── store/                 # document / commands / history / selection / viewport
├── frame/shared|sortable|draggable
├── widget/
├── editor/page|common|array|json
├── modules/shared|sortable|draggable
├── utils/
└── styles/
```

## 仓库内验证

在仓库根目录执行：

```bash
npm run test -- --package-name renderer
npm run build -- --package-name renderer
```

## 许可证

MIT
