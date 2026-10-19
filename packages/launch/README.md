# @deot/docs-launch

轻量浏览器启动入口：使用 HTML 选定的 CDN，先注入完整的 Client CSS，再注入 Client module。

```html
<div id="app"></div>
<script>
	window.$docs = {
		locales: { 'zh-CN': { label: '简体中文' } },
		routes: { '/:name': { content: 'default' } },
		// 可省略，launch 缺省使用 jsDelivr。
		runtime: { mode: 'production', cdn: 'https://cdn.jsdelivr.net/npm/' },
		resolve: {
			cdn: ({ url }) => url
		}
	};
</script>
<script type="module" src="https://cdn.jsdelivr.net/npm/@deot/docs-launch/+esm"></script>
```

CDN 选择由 HTML 负责。本仓库的 [`index.html`](../../index.html) 并发下载 jsDelivr、ESM UNPKG 的 launch 入口，首个完整下载成功的 JavaScript 响应胜出，随后取消其余请求、将对应 npm CDN 前缀写入 `$docs.runtime.cdn`，并将下载的代码注入为 module。只执行胜出的入口，无需再次下载；全部失败或超过 15 秒时显示刷新重试提示。launch 是自包含 ESM，无需额外探针、节点缓存或 `cdns` 配置。

> 缓存说明：未指定版本的 `+esm` / `dist/index.js` 地址可能仍返回旧版启动入口。发布后若出现空白页或模块导出错误，可先禁用浏览器缓存刷新，并检查实际加载的启动脚本版本；若 CDN 仍返回旧内容，需要清理对应 CDN 缓存或改用明确版本的地址。
>
> 可选预防措施：使用 `@deot/docs-launch@具体版本/dist/index.js` 固定自包含启动入口，并通过 `resolve.cdn` 为 Client JS 与 CSS 指定同一版本。自定义 HTML 下载入口时，可使用 `cache: 'no-cache'` 重新验证浏览器缓存，但不能保证 CDN 节点立即更新。这些建议需按需配置，当前入口未自动启用。

launch 读取 `$docs.runtime.cdn`，缺省使用 `https://cdn.jsdelivr.net/npm/`，补全 production 运行模式；同一页面重复启动复用同一任务。启动器先插入 Client stylesheet link，再插入 Client module script，不等待 CSS load 事件才请求 JS。Client 浏览器 CSS 已包含主应用使用的 Renderer、Markdown、Playground 和延迟页面样式，无需再加载三个子包的 CSS。

两个 CDN 都显式加载 `/@deot/docs-client/dist/bundle/index.js` 和 `/@deot/docs-client/dist/bundle/index.style.css`。Bundle 由 `--bundle-package client` 生成，普通 ES 继续供项目打包器使用。所有地址先按选中节点生成，再经过用户可选的同步 `resolve.cdn({ url })`。返回 `null`、`undefined` 或空字符串时保留原地址，钩子本身不会被启动器替换。

Client 与 Playground 内置 jsDelivr / UNPKG 地址转换，继续使用选中的同一节点，再调用用户钩子。原配置与缓存保留原始地址。转换服务内部模块引用及重定向仍交给浏览器处理。

任一 Client 启动资源加载失败，或 CSS、JS 两份资源在 30 秒内未全部加载完成时，输出控制台错误，并在尚未挂载的 `#app` 中显示刷新重试提示。launch 不切换 CDN 或自动重载页面。

包没有运行时依赖，通过 `--minify-package 'launch'` 生成单个自包含的普通压缩 ESM，体积预算为 3 KiB、gzip 后 1.5 KiB。无需 eval 或解压器。聚合包不会重导出自动启动入口。

本仓库 `doc dev` 确认 Client 包名、源码入口及真实路径边界后，将 HTML 的 launch 地址改写到本地 Client 源码，交给 Vite 编译；`doc preview` 映射预先构建的本地 launch 和 Client Bundle，先执行 `npm run build`，预览适配会先调用用户钩子，再映射本地 Client URL。消费项目仍使用声明的发布地址。

发布顺序：先发布包含完整 CSS 的 Client，确认两个 CDN 均能提供新产物，再发布读取 `runtime.cdn` 的 launch，最后更新 HTML 入口、开发服务与聚合包。
