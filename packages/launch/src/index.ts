const DEFAULT_CDNS = ['https://cdn.jsdelivr.net/npm/', 'https://esm.unpkg.com/'];
const taskKey = Symbol.for('@deot/docs-launch');
const cacheKey = '@deot/docs-launch:cdn';

interface LaunchTarget {
	document: Document;
	localStorage: Storage;
	sessionStorage: Storage;
	location: Pick<Location, 'reload'>;
	$docs?: {
		cdns?: string[];
		runtime?: { mode?: string; cdn?: string };
		resolve?: { cdn?: (context: { url: string }) => string | null | undefined };
	};
	[taskKey]?: Promise<void>;
}

// 探测一次，先插入样式标签，再插入 Client module；下载由浏览器调度。
export const launch = (target: Window = window): Promise<void> => {
	const host = target as unknown as LaunchTarget;
	return host[taskKey] ??= (async () => {
		const config = host.$docs ||= {};
		const configured = config.cdns?.map(value => value.trim()).filter(Boolean);
		const candidates = [...new Set((configured?.length ? configured : DEFAULT_CDNS)
			.map(value => `${value.replace(/\/+$/u, '')}/`))];
		let failed: string[] = [];
		try {
			failed = JSON.parse(host.sessionStorage.getItem(cacheKey) || '[]')
				.filter((value: string) => candidates.includes(value));
			host.sessionStorage.removeItem(cacheKey);
		} catch { /* 无法保存重试状态时不自动重载。 */ }
		const cdns = candidates.filter(value => !failed.includes(value));
		const cache = (value: string) => {
			try {
				host.localStorage.setItem(cacheKey, value);
			} catch { /* 存储不可用时仍可启动。 */ }
		};
		let measured = false;
		const probe = (async () => {
			const controllers = cdns.map(() => new AbortController());
			try {
				return await Promise.any(cdns.map(async (origin, index) => {
					const controller = controllers[index];
					const timer = setTimeout(() => controller.abort(), 5000);
					try {
						const response = await fetch(`${origin}@deot/docs-theme@1.1.4/package.json?raw`, {
							signal: controller.signal
						});
						if (!response.ok) throw new Error(`${response.status} ${origin}`);
						await response.text();
						return origin;
					} finally {
						clearTimeout(timer);
					}
				}));
			} finally {
				controllers.forEach(controller => controller.abort());
			}
		})().then((cdn) => {
			if (!failed.includes(cdn)) {
				measured = true;
				cache(cdn);
			}
			return cdn;
		}).catch(() => undefined);
		let cdn = '';
		try {
			cdn = host.localStorage.getItem(cacheKey) || '';
		} catch { /* 存储不可用时先探测。 */ }
		if (!cdns.includes(cdn)) cdn = await probe || cdns[0];
		if (!cdn) throw new Error('[docs-launch] No CDN available');
		config.runtime = { ...config.runtime, mode: config.runtime?.mode || 'production', cdn };
		const resolve = (asset: string) => {
			const url = `${cdn}${asset}`;
			return config.resolve?.cdn?.({ url }) || url;
		};
		const doc = host.document;
		let pending = 5;
		let done = false;
		const timer = setTimeout(() => finish(), 30000);
		const finish = (event?: Event) => {
			if (done || (event?.type === 'load' && --pending)) return;
			done = true;
			clearTimeout(timer);
			if (event?.type === 'load') {
				if (!measured) cache(cdn);
				return;
			}
			failed.push(cdn);
			const next = cdns.find(value => !failed.includes(value));
			cache(next || '');
			if (next) {
				try {
					host.sessionStorage.setItem(cacheKey, JSON.stringify(failed));
					host.location.reload();
					return;
				} catch { /* 防止无法保存重试状态时无限刷新。 */ }
			}
			console.error('[docs-launch] Failed to load', cdn, event);
			const app = doc.querySelector('#app:not([data-v-app])');
			if (app) app.textContent = '文档资源加载失败，请刷新重试。';
		};
		for (const name of ['client', 'renderer', 'markdown', 'playground']) {
			const link = doc.createElement('link');
			link.rel = 'stylesheet';
			link.href = resolve(`@deot/docs-${name}/dist/index.style.css`);
			link.addEventListener('load', finish);
			link.addEventListener('error', finish);
			doc.head.appendChild(link);
		}
		const script = doc.createElement('script');
		script.type = 'module';
		script.src = resolve(`@deot/docs-client${new URL(cdn).hostname === 'esm.unpkg.com' ? '/dist/index.js' : '/+esm'}`);
		script.addEventListener('load', finish);
		script.addEventListener('error', finish);
		doc.body.appendChild(script);
	})();
};

if (typeof window !== 'undefined' && document.querySelector('#app')) {
	void launch().catch(error => console.error('[docs-launch] Failed to launch', error));
}
