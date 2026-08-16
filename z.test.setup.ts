import 'fake-indexeddb/auto';

// Node 25 可能暴露一个没有完整 Storage API 的实验性 localStorage。组件库的
// Icon 初始化会读取它，因此测试环境统一补成与浏览器语义一致的内存实现。
if (typeof window !== 'undefined' && typeof window.localStorage?.getItem !== 'function') {
	const values = new Map<string, string>();
	Object.defineProperty(window, 'localStorage', {
		configurable: true,
		value: {
			get length() { return values.size; },
			clear: () => values.clear(),
			getItem: (key: string) => values.get(key) ?? null,
			key: (index: number) => [...values.keys()][index] ?? null,
			removeItem: (key: string) => values.delete(key),
			setItem: (key: string, value: string) => values.set(key, String(value))
		} satisfies Storage
	});
}

// Select 等组件会异步拉取 icon sprite。Node 没有 document，Manager.load 会以
// “invaild url” 拒绝；jsdom 也无法访问 alicdn。只在浏览器环境预置图标，并吞掉
// 该已知 rejection，避免 Vitest 把 dever 等 Node 用例判为未处理错误。
if (typeof document !== 'undefined') {
	try {
		const { IconManager } = await import('@deot/vc-components');
		const stub = { viewBox: '0 0 1024 1024', path: [{ d: 'M0 0', fill: '' }] };
		for (const type of ['down', 'up', 'left', 'right', 'close', 'search']) {
			IconManager.icons[type] ||= stub;
		}
		const originalLoad = IconManager.load.bind(IconManager);
		IconManager.load = (url: string) => {
			const request = originalLoad(url);
			void request.catch(() => undefined);
			return request;
		};
		setTimeout(() => {
			void Promise.resolve(IconManager.basicStatus).catch(() => undefined);
		}, 0);
	} catch {
		// 未安装 vc-components 时跳过。
	}
}
