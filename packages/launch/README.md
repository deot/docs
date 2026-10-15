# @deot/docs-launch

轻量浏览器启动入口：并发探测 CDN，选定唯一节点，先注入四份 CSS，再注入 Client module。

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

省略或清空 `cdns` 时使用默认候选。探针请求同一份固定小文件 `@deot/docs-theme@1.1.4/package.json?raw`，最先完整读取成功响应的节点胜出，每个请求超时 5 秒，随后取消剩余探针。结果写入 `$docs.runtime.cdn`，同一页面重复启动复用同一任务。

选中节点保存在 `localStorage['@deot/docs-launch:cdn']`。有缓存且该节点仍在当前候选中时，立即使用缓存启动，同时静默探测并更新缓存，供下次页面启动使用；本次页面的节点和资源保持不变。没有可用缓存时，先探测再加载。后台探测失败时保留原缓存；存储不可用时仍可正常探测和启动。

启动器按 Client、Renderer、Markdown、Playground 的顺序插入 stylesheet link，再插入 Client module script；不等待 CSS load 事件才请求 JS。所有地址先按选中节点生成，再经过用户可选的同步 `resolve.cdn({ url })`。返回 `null`、`undefined` 或空字符串时保留原地址，钩子本身不会被启动器替换，探针不经过钩子。

Client 与 Playground 内置 jsDelivr / UNPKG 地址转换，继续使用选中的同一节点，再调用用户钩子。原配置与缓存保留原始地址。转换服务内部模块引用及重定向仍交给浏览器处理。

没有可用缓存且全部探针失败时不启动应用；选定后的资源加载失败只报告错误，不跨 CDN 回退。每次页面启动只探测一次，不提供持续测速或网络代理。启动器自身首次下载由 HTML 的脚本地址决定。自定义候选默认使用 jsDelivr 兼容路径，特殊资源入口通过最终钩子调整。

包没有运行时依赖，通过 `--minify-package 'launch'` 生成单个自包含的普通压缩 ESM，体积预算为 3 KiB、gzip 后 1.5 KiB。无需 eval 或解压器。聚合包不会重导出自动启动入口。

本仓库 `doc dev` 继续使用本地 Client；`doc preview` 构建并映射本地 launch 和 Client，预览适配会先调用用户钩子，再映射本地 Client URL。消费项目仍使用声明的发布地址。

发布顺序：先发布支持 `runtime.cdn` / `resolve.cdn` 的 Playground 与 Client，再发布 launch，最后迁移 HTML 入口。
