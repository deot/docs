const DEFAULT_CDNS = ['https://cdn.jsdelivr.net/npm/', 'https://esm.unpkg.com/'];
const taskKey = Symbol.for('@deot/docs-launch');
const cacheKey = '@deot/docs-launch:cdn';

interface LaunchTarget {
	document: Document;
	localStorage: Storage;
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
		const cdns = [...new Set((configured?.length ? configured : DEFAULT_CDNS)
			.map(value => `${value.replace(/\/+$/u, '')}/`))];
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
			try {
				host.localStorage.setItem(cacheKey, cdn);
			} catch { /* 存储不可用时仍可启动。 */ }
			return cdn;
		});
		let cdn = '';
		try {
			cdn = host.localStorage.getItem(cacheKey) || '';
		} catch { /* 存储不可用时先探测。 */ }
		if (cdns.includes(cdn)) {
			void probe.catch(() => {});
		} else {
			cdn = await probe;
		}
		config.runtime = { ...config.runtime, mode: config.runtime?.mode || 'production', cdn };
		const resolve = (asset: string) => {
			const url = `${cdn}${asset}`;
			return config.resolve?.cdn?.({ url }) || url;
		};
		const doc = host.document;
		for (const name of ['client', 'renderer', 'markdown', 'playground']) {
			const link = doc.createElement('link');
			link.rel = 'stylesheet';
			link.href = resolve(`@deot/docs-${name}/dist/index.style.css`);
			link.onerror = () => console.error(`[docs-launch] Failed to load ${link.href}`);
			doc.head.appendChild(link);
		}
		const script = doc.createElement('script');
		script.type = 'module';
		script.src = resolve(`@deot/docs-client${new URL(cdn).hostname === 'esm.unpkg.com' ? '' : '/+esm'}`);
		script.onerror = () => console.error(`[docs-launch] Failed to load ${script.src}`);
		doc.body.appendChild(script);
	})();
};

if (typeof window !== 'undefined' && document.querySelector('#app')) {
	void launch().catch(error => console.error('[docs-launch] Failed to launch', error));
}
