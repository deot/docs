const loaders: Record<string, () => Promise<unknown>> = {
	'vue': () => import('vue'),
	'vue-router': () => import('vue-router'),
	'pinia': () => import('pinia'),
	'@deot/helper': () => import('@deot/helper'),
	'@deot/helper-cache': () => import('@deot/helper-cache'),
	'@deot/helper-device': () => import('@deot/helper-device'),
	'@deot/helper-dom': () => import('@deot/helper-dom'),
	'@deot/helper-emitter': () => import('@deot/helper-emitter'),
	'@deot/helper-fp': () => import('@deot/helper-fp'),
	'@deot/helper-is': () => import('@deot/helper-is'),
	'@deot/helper-load': () => import('@deot/helper-load'),
	'@deot/helper-resize': () => import('@deot/helper-resize'),
	'@deot/helper-route': () => import('@deot/helper-route'),
	'@deot/helper-scheduler': () => import('@deot/helper-scheduler'),
	'@deot/helper-shared': () => import('@deot/helper-shared'),
	'@deot/helper-unicode': () => import('@deot/helper-unicode'),
	'@deot/helper-utils': () => import('@deot/helper-utils'),
	'@deot/helper-validator': () => import('@deot/helper-validator'),
	'@deot/helper-wheel': () => import('@deot/helper-wheel'),

	'@deot/http-client': () => import('@deot/http-client'),
	'@deot/http-core': () => import('@deot/http-core'),
	'@deot/http-hooks': () => import('@deot/http-hooks'),
	'@deot/http': () => import('@deot/http'),
	'@deot/vc': () => import('@deot/vc'),
	'@deot/vc-components': () => import('@deot/vc-components'),
	'@deot/vc-hooks': () => import('@deot/vc-hooks'),
	'@deot/vc-locale': () => import('@deot/vc-locale'),
	'lodash-es': () => import('lodash-es'),
	'echarts': () => import('echarts'),
	'photoswipe': () => import('photoswipe'),
	'jszip': () => import('jszip'),
	'jspdf': () => import('jspdf'),
	'dayjs': async () => (await import('dayjs')).default
};

const cache = new Map<string, Promise<unknown>>();

/** 直接渲染可从宿主包注入的说明符。用到时再加载，避免预览启动时执行全部副作用。 */
export const localBuiltinIds = new Set(Object.keys(loaders));

export const ensureLocalBuiltin = (id: string): Promise<unknown> => {
	const loader = loaders[id];
	if (!loader) return Promise.reject(new Error(`[Playground] 没有本地模块 "${id}"`));
	let pending = cache.get(id);
	if (!pending) {
		pending = loader();
		cache.set(id, pending);
	}
	return pending;
};
