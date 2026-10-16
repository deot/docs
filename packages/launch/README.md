# @deot/docs-launch

轻量浏览器启动入口：并发探测 CDN，选定唯一节点，先注入完整的 Client CSS，再注入 Client module。

```html
<div id="app"></div>
<script>
	window.$docs = {
		locales: { 'zh-CN': { label: '简体中文' } },
		routes: { '/:name': { content: 'default' } },
		// 可省略，以下是默认候选。
		cdns: ['https://cdn.jsdelivr.net/npm/', 'https://esm.unpkg.com/'],
		resolve: {
			cdn: ({ url }) => url
		}
	};
</script>
<script type="module" src="https://cdn.jsdelivr.net/npm/@deot/docs-launch/+esm"></script>
```

省略或清空 `cdns` 时使用默认候选。探针请求同一份固定小文件 `@deot/docs-theme@1.1.4/package.json?raw`，最先完整读取成功响应的节点胜出，每个请求超时 5 秒，随后取消剩余探针。探针全部失败时仍按候选顺序尝试实际资源，避免元数据请求失败阻断启动。结果写入 `$docs.runtime.cdn`，同一页面重复启动复用同一任务。

选中节点保存在 `localStorage['@deot/docs-launch:cdn']`。有缓存且该节点仍在当前候选中时，立即使用缓存启动，同时静默探测并更新缓存，供下次页面启动使用；本次页面的节点和资源保持不变。没有可用缓存时，先探测再加载。后台探测失败时保留原缓存；存储不可用时仍可正常探测和启动。

启动器先插入 Client stylesheet link，再插入 Client module script；Client 浏览器 CSS 已包含主应用使用的 Renderer、Markdown、Playground 和延迟页面样式，无需再加载三个子包的 CSS。不等待 CSS load 事件才请求 JS。所有地址先按选中节点生成，再经过用户可选的同步 `resolve.cdn({ url })`。返回 `null`、`undefined` 或空字符串时保留原地址，钩子本身不会被启动器替换，探针不经过钩子。

两个 CDN 都显式加载 `/@deot/docs-client/dist/bundle/index.js` 和 `/@deot/docs-client/dist/bundle/index.style.css`。Bundle 由 `--bundle-package client` 生成，普通 ES 继续供项目打包器使用。

Client 与 Playground 内置 jsDelivr / UNPKG 地址转换，继续使用选中的同一节点，再调用用户钩子。原配置与缓存保留原始地址。转换服务内部模块引用及重定向仍交给浏览器处理。

任一启动资源加载失败（包括错误 MIME、依赖请求失败），或 CSS、JS 两份资源在 30 秒内未全部加载完成时，排除当前节点、更新节点缓存并重载整页，尝试剩余候选。通过重载隔离可能迟到的模块执行，每轮每个候选只尝试一次。重试状态暂存在 `sessionStorage['@deot/docs-launch:cdn']`，下次启动读取后移除；后台探针不会重新缓存已失败的节点。没有可用的探针结果时，成功加载的资源节点也会写入缓存。

候选全部失败后清空节点缓存，输出控制台错误，并在尚未挂载的 `#app` 中显示刷新重试提示；手动刷新可重新开始一轮尝试。无法保存重试状态时停止自动重载，避免无限刷新。每次页面启动只探测一次，不提供持续测速或网络代理。启动器自身首次下载由 HTML 决定；本仓库入口在 launch 下载失败或超过 15 秒时尝试备用 ESM UNPKG JS 地址。自定义候选默认遵循 jsDelivr 路径规则，特殊入口可通过最终钩子调整。

包没有运行时依赖，通过 `--minify-package 'launch'` 生成单个自包含的普通压缩 ESM，体积预算为 3 KiB、gzip 后 1.5 KiB。无需 eval 或解压器。聚合包不会重导出自动启动入口。

HTML 统一声明双 CDN launch 入口。本仓库 `doc dev` 确认 Client 包名、源码入口及真实路径边界后，将两条 launch 地址改写到本地 Client 源码，交给 Vite 编译；`doc preview` 映射预先构建的本地 launch 和 Client Bundle，先执行 `npm run build`，预览适配会先调用用户钩子，再映射本地 Client URL。消费项目仍使用声明的发布地址。

发布顺序：先发布包含完整 CSS 的 Client，确认两个 CDN 均能提供新产物，再发布只加载 Client CSS/JS 的 launch，最后发布开发服务与聚合包。回滚时先恢复 launch 的四份 CSS 加载；完整 Client CSS 可以保留。
