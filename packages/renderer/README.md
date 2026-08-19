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
| `features` | `modules/sortable/features` | 是 | 特性 |
| `steps` | `modules/sortable/steps` | 是 | 步骤 |
| `faq` | `modules/sortable/faq` | 是 | 问答 |
| `cta` | `modules/sortable/cta` | 是 | 行动条 |
| `ads` | `modules/sortable/promo` | 是 | 广告位；目录名避开路径中的 `/ads/` 拦截 |

`title` / `text` / `list` / `image` / `actions` 与双 Frame 内容模块同属 `modules/shared`。
当前没有仅自由布局可用的内置模块。

与 `@deot/docs-client` 一起使用时，`docs:` 前缀留给 Client 的 `docs:markdown` 与
`docs:sfc`，不要在 `$docs.renderers` 里注册同名前缀。

## 使用

```vue
<Renderer :document="document" :modules="modules" />
<Combo v-model="document" :modules="modules" @save="handleSave" />
```

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
