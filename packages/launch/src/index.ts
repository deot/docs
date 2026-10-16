const DEFAULT_CDN = 'https://cdn.jsdelivr.net/npm/';
const taskKey = Symbol.for('@deot/docs-launch');

interface LaunchTarget {
	document: Document;
	$docs?: {
		runtime?: { mode?: string; cdn?: string };
		resolve?: { cdn?: (context: { url: string }) => string | null | undefined };
	};
	[taskKey]?: Promise<void>;
}

// 使用 HTML 选定的 CDN，先插入样式标签，再插入 Client module。
export const launch = (target: Window = window): Promise<void> => {
	const host = target as unknown as LaunchTarget;
	return host[taskKey] ??= (async () => {
		const config = host.$docs ||= {};
		const cdn = `${(config.runtime?.cdn?.trim() || DEFAULT_CDN).replace(/\/+$/u, '')}/`;
		config.runtime = { ...config.runtime, mode: config.runtime?.mode || 'production', cdn };
		const resolve = (asset: string) => {
			const url = `${cdn}${asset}`;
			return config.resolve?.cdn?.({ url }) || url;
		};
		const doc = host.document;
		const link = doc.createElement('link');
		link.rel = 'stylesheet';
		link.href = resolve('@deot/docs-client/dist/bundle/index.style.css');
		const script = doc.createElement('script');
		script.type = 'module';
		script.src = resolve('@deot/docs-client/dist/bundle/index.js');
		const resources = [link, script];
		let pending = resources.length;
		let done = false;
		const timer = setTimeout(() => finish(), 30000);
		const finish = (event?: Event) => {
			if (done || (event?.type === 'load' && --pending)) return;
			done = true;
			clearTimeout(timer);
			if (event?.type === 'load') return;
			console.error('[docs-launch] Failed to load', cdn, event);
			const app = doc.querySelector('#app:not([data-v-app])');
			if (app) app.textContent = '文档资源加载失败，请刷新重试。';
		};
		for (const resource of resources) {
			resource.addEventListener('load', finish);
			resource.addEventListener('error', finish);
		}
		doc.head.appendChild(link);
		doc.body.appendChild(script);
	})();
};

if (typeof window !== 'undefined' && document.querySelector('#app')) {
	void launch().catch(error => console.error('[docs-launch] Failed to launch', error));
}
