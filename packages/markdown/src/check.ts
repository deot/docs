/**
 * `doc check` 的页面钩子。只有在页面加载前设置了 `window.__DOCS_CHECK__` 时启用：
 * Markdown 不再一次挂载全部 Playground，而是登记下来，由检查脚本逐个挂载、收集错误、再卸载。
 */

export interface DocsCheckPlayground {
	/** 当前页面内的序号，传给 `mount`。 */
	index: number;
	/** 示例标题；没有标题时为空串。 */
	title: string;
	/** 源文件中 `:::playground` 的行号。 */
	line?: number;
	/** 按配置合并后是否直接渲染。 */
	local: boolean;
	/** 配置警告。 */
	warnings: string[];
	/** 配置错误（`PLAYGROUND: …`）。有错误的示例不能挂载。 */
	error?: string;
}

export interface DocsCheckMountOptions {
	/** 强制 local / iframe；不传时按示例自己的配置。 */
	local?: boolean;
	/** 等待预览完成的上限（毫秒）。 */
	timeout?: number;
	/** 预览完成后继续收集异步错误的时间（毫秒）。 */
	settle?: number;
}

export interface DocsCheckError {
	/** `compile` 为编译、加载、链接错误；`runtime` 为运行时错误；`timeout` 为挂载超时。 */
	kind: 'compile' | 'runtime' | 'timeout' | 'config';
	message: string;
}

export interface DocsCheckMountResult {
	status: 'ok' | 'error' | 'timeout';
	local: boolean;
	errors: DocsCheckError[];
}

export interface DocsCheckEntry extends Omit<DocsCheckPlayground, 'index'> {
	element: HTMLElement;
	mount?: (options: DocsCheckMountOptions) => Promise<DocsCheckMountResult>;
}

export interface DocsCheckHooks {
	/** 每完成一次 Markdown 渲染加一。 */
	renders?: number;
	playgrounds?: () => DocsCheckPlayground[];
	mount?: (index: number, options?: DocsCheckMountOptions) => Promise<DocsCheckMountResult>;
	[key: string]: unknown;
}

declare global {
	interface Window {
		__DOCS_CHECK__?: DocsCheckHooks;
	}
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_SETTLE = 500;
const registry = new Map<HTMLElement, DocsCheckEntry[]>();

/**
 * @returns 检查钩子；普通访问时为 undefined。
 */
export const getDocsCheck = (): DocsCheckHooks | undefined => {
	if (typeof window === 'undefined') return undefined;
	const hooks = window.__DOCS_CHECK__;
	return hooks && typeof hooks === 'object' ? hooks : undefined;
};

const listEntries = () => [...registry.values()].flat()
	.filter(entry => entry.element.isConnected)
	.sort((a, b) => (
		a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
	));

const installHooks = (hooks: DocsCheckHooks) => {
	if (hooks.playgrounds) return;
	hooks.renders ??= 0;
	hooks.playgrounds = () => listEntries().map((entry, index) => ({
		index,
		title: entry.title,
		line: entry.line,
		local: entry.local,
		warnings: entry.warnings,
		...(entry.error === undefined ? {} : { error: entry.error })
	}));
	hooks.mount = async (index, options = {}) => {
		const entry = listEntries()[index];
		if (!entry) throw new RangeError(`Playground ${index} does not exist`);
		if (!entry.mount) {
			return { status: 'error', local: entry.local, errors: [{ kind: 'config', message: entry.error || 'not mountable' }] };
		}
		return entry.mount(options);
	};
};

/**
 * 登记一次渲染的示例，替换同一容器之前的登记。
 * @param el Markdown 容器。
 * @param entries 示例列表。
 */
export const registerCheckEntries = (el: HTMLElement, entries: DocsCheckEntry[]) => {
	const hooks = getDocsCheck();
	if (!hooks) return;
	installHooks(hooks);
	registry.set(el, entries);
};

/**
 * @param el Markdown 容器。
 */
export const removeCheckEntries = (el: HTMLElement) => {
	registry.delete(el);
};

/** 通知检查脚本：一次 Markdown 渲染已经完成。 */
export const markCheckRendered = () => {
	const hooks = getDocsCheck();
	if (!hooks) return;
	installHooks(hooks);
	hooks.renders = (hooks.renders || 0) + 1;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const collectErrors = (item: HTMLElement): DocsCheckError[] => [
	...item.querySelectorAll<HTMLElement>('.docs-playground__runtime-error, .docs-playground__error')
].map(node => ({
	kind: node.dataset.errorKind === 'runtime' ? 'runtime' as const : 'compile' as const,
	message: node.textContent?.trim() || ''
})).filter(error => error.message);

const isPreviewReady = (item: HTMLElement) => {
	const mount = item.querySelector('.docs-playground-local__mount');
	if (mount?.childElementCount) return true;
	for (const frame of item.querySelectorAll<HTMLIFrameElement>('iframe:not(.docs-playground-local__bridge)')) {
		try {
			if (frame.contentDocument?.querySelector('#app')?.childElementCount) return true;
		} catch {
			// 跨域 iframe 读不到，只能等超时。
		}
	}
	return false;
};

/**
 * 等预览挂载完成（或出错），再停留一段时间收集异步错误。
 * @param item 示例挂载点。
 * @param local 实际使用的渲染方式。
 * @param options 等待参数。
 * @returns 检查结果。
 */
export const waitForCheckedPreview = async (
	item: HTMLElement,
	local: boolean,
	options: DocsCheckMountOptions
): Promise<DocsCheckMountResult> => {
	const timeout = options.timeout ?? DEFAULT_TIMEOUT;
	const deadline = Date.now() + timeout;
	let finished = false;
	while (Date.now() < deadline) {
		if (collectErrors(item).length || isPreviewReady(item)) {
			finished = true;
			break;
		}
		await sleep(50);
	}
	await sleep(options.settle ?? DEFAULT_SETTLE);
	const errors = collectErrors(item);
	if (errors.length) return { status: 'error', local, errors };
	if (!finished) return { status: 'timeout', local, errors: [{ kind: 'timeout', message: `预览在 ${timeout}ms 内没有完成挂载` }] };
	return { status: 'ok', local, errors: [] };
};
