/**
 * 本地预览的第一次编译会动态加载浏览器版 Vue 编译器。
 * 全量并行时这一步经常超过 waitFor 的默认 1 秒，先在用例开始前完成加载。
 */
export const preloadLocalPlayground = async () => {
	const sfc = await import('../src/core/runtime/local/compile/sfc');
	await Promise.all([
		sfc.loadCompiler(),
		import('../src/core/runtime/local/local-sandbox.vue'),
		import('../src/core/runtime/local/compile'),
		import('../src/core/runtime/local/linker'),
		import('../src/core/runtime/local/modules'),
		import('../src/core/runtime/local/compile/files'),
		import('../src/core/runtime/local/remote')
	]);
};
