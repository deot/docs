import type { Ref } from 'vue';

export interface PlaygroundRunOptions {
	visible?: Ref<boolean> | (() => boolean);
}

/** iframe 内的 Window 类型；不会向普通业务页面声明必然存在的全局变量。 */
export interface PlaygroundWindow extends Window {
	$docsPlayground: PlaygroundService;
}

type PreviewVue = Pick<typeof import('vue'), 'getCurrentScope' | 'onScopeDispose' | 'watch' | 'toValue' | 'isRef'>;

interface PreviewRequest {
	readonly ready: Promise<boolean>;
	readonly closed: Promise<void>;
	readonly released: boolean;
	release: () => void;
	watch: (visible: NonNullable<PlaygroundRunOptions['visible']>) => void;
}

/** Preview iframe 内的高度服务；class 会被序列化到 iframe 执行。 */
export class PlaygroundService {
	private readonly target: Window;
	private readonly vue: PreviewVue;
	private readonly session: string;
	/* istanbul ignore next -- class 会被序列化到没有覆盖率运行时的 iframe。 */
	private sequence = 0;
	/* istanbul ignore next -- class 会被序列化到没有覆盖率运行时的 iframe。 */
	private disposed = false;
	private manual?: PreviewRequest;
	/* istanbul ignore next -- class 会被序列化到没有覆盖率运行时的 iframe。 */
	private readonly requests = new Set<PreviewRequest>();
	/* istanbul ignore next -- class 会被序列化到没有覆盖率运行时的 iframe。 */
	private readonly owners = new Set<() => void>();

	/**
	 * @param target 当前预览窗口。
	 * @param vue 与预览应用共用的 Vue 实例。
	 */
	/* istanbul ignore next -- class 会被序列化到没有覆盖率运行时的 iframe。 */
	constructor(target: Window, vue: PreviewVue) {
		this.target = target;
		this.vue = vue;
		this.session = `${Date.now()}-${Math.random()}`;
		this.dispose = this.dispose.bind(this);
		this.post('start');
		this.target.addEventListener('pagehide', this.dispose);
	}

	/**
	 * 申请手动临时高度；新请求会替换上一个手动请求。
	 * @param height iframe 最小高度。
	 * @returns iframe 是否在超时前应用目标高度。
	 */
	enable(height: number): Promise<boolean> {
		this.validateHeight(height);
		this.manual?.release();
		this.manual = this.createRequest(height);
		return this.manual.ready;
	}

	/** 释放手动临时高度，不影响 `run` 创建的请求。 */
	disable(): void {
		this.manual?.release();
		this.manual = undefined;
	}

	run(height: number): (visible: boolean) => Promise<boolean | undefined>;

	run<Args extends unknown[], Result>(
		height: number,
		handler: (...args: Args) => Result
	): (...args: Args) => Promise<Awaited<Result> | undefined>;

	run<Args extends unknown[], Result>(
		height: number,
		options: PlaygroundRunOptions,
		handler: (...args: Args) => Result
	): (...args: Args) => Promise<Awaited<Result> | undefined>;

	run(
		height: number,
		options: PlaygroundRunOptions & { visible: Ref<boolean> }
	): () => Promise<void | undefined>;

	/**
	 * 创建等待高度后执行的事件处理函数。
	 * @param height iframe 最小高度。
	 * @param optionsOrHandler 可见状态配置，或最后一个 handler。
	 * @param lastHandler 使用配置时的最后一个 handler。
	 * @returns 保留 handler 参数和结果的异步事件处理函数。
	 */
	run<Args extends unknown[], Result>(
		height: number,
		optionsOrHandler?: PlaygroundRunOptions | ((...args: Args) => Result),
		lastHandler?: (...args: Args) => Result
	) {
		this.validateHeight(height);
		if (optionsOrHandler === undefined) {
			return (visible: boolean) => {
				if (visible) return this.enable(height);
				this.disable();
				return Promise.resolve(undefined);
			};
		}
		const options = typeof optionsOrHandler === 'function' ? {} : optionsOrHandler;
		const visible = options.visible;
		if (visible !== undefined && !this.vue.isRef(visible) && typeof visible !== 'function') {
			throw new TypeError('Playground visible must be a ref or getter');
		}
		const handler = typeof optionsOrHandler === 'function'
			? optionsOrHandler
			: lastHandler ?? (this.vue.isRef(visible) ? () => { visible.value = true; } : undefined);
		if (typeof handler !== 'function') throw new TypeError('Playground run requires a handler');

		let ownerDisposed = false;
		let current: PreviewRequest | undefined;
		let pending: Promise<Awaited<Result> | undefined> | undefined;
		const disposeOwner = () => {
			ownerDisposed = true;
			current?.release();
			this.owners.delete(disposeOwner);
		};
		this.owners.add(disposeOwner);
		if (this.vue.getCurrentScope()) this.vue.onScopeDispose(disposeOwner);

		return (...args: Args) => {
			if (this.disposed || ownerDisposed) return Promise.resolve(undefined);
			if (pending) return pending;
			const request = current = this.createRequest(height);
			let executionFinished = false;
			const unlock = () => {
				if (executionFinished && request.released && current === request) {
					pending = undefined;
					current = undefined;
				}
			};
			void request.closed.then(unlock);
			const execution = (async (): Promise<Awaited<Result> | undefined> => {
				try {
					if (!await request.ready || ownerDisposed || this.disposed) return undefined;
					if (visible) request.watch(visible);
					const result = await handler(...args);
					if (!visible || !this.vue.toValue(visible)) request.release();
					return result as Awaited<Result>;
				} catch (error) {
					request.release();
					throw error;
				} finally {
					executionFinished = true;
					unlock();
				}
			})();
			pending = execution;
			return execution;
		};
	}

	/** 释放当前预览应用持有的全部高度和监听。 */
	/* istanbul ignore next -- 注入测试会从序列化后的 iframe class 调用该方法。 */
	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		for (const disposeOwner of this.owners) disposeOwner();
		for (const request of this.requests) request.release();
		this.post('stop');
		this.target.removeEventListener('pagehide', this.dispose);
		if ((this.target as PlaygroundWindow).$docsPlayground === this) {
			delete (this.target as Partial<PlaygroundWindow>).$docsPlayground;
		}
	}

	/** @param height iframe 最小高度。 */
	private validateHeight(height: number): void {
		if (!Number.isFinite(height) || height <= 0) {
			throw new TypeError('Playground height must be a positive finite number');
		}
	}

	/**
	 * @param operation 请求操作。
	 * @param id 请求标识。
	 * @param height iframe 最小高度。
	 */
	/* istanbul ignore next -- 构造和销毁时会从序列化后的 iframe class 调用该方法。 */
	private post(operation: string, id = 0, height = 0): void {
		this.target.parent.postMessage({
			action: 'docs:height',
			session: this.session,
			operation,
			id,
			height
		}, '*');
	}

	/**
	 * @param height iframe 最小高度。
	 * @returns 内部等待与释放句柄。
	 */
	private createRequest(height: number): PreviewRequest {
		this.validateHeight(height);
		const id = ++this.sequence;
		let released = false;
		let settled = false;
		let frame = 0;
		let timer = 0;
		let stopWatch: (() => void) | undefined;
		let resolveReady!: (ready: boolean) => void;
		let resolveClosed!: () => void;
		const ready = new Promise<boolean>((resolve) => { resolveReady = resolve; });
		const closed = new Promise<void>((resolve) => { resolveClosed = resolve; });
		const stopWaiting = () => {
			this.target.cancelAnimationFrame(frame);
			if (timer) {
				this.target.clearTimeout(timer);
				timer = 0;
			}
			this.target.removeEventListener('message', onMessage);
		};
		const release = () => {
			if (released) return;
			released = true;
			stopWaiting();
			stopWatch?.();
			resolveReady(false);
			resolveClosed();
			this.requests.delete(request);
			this.post('release', id);
		};
		const check = () => {
			if (released) return;
			if (this.target.innerHeight >= height) {
				settled = true;
				stopWaiting();
				resolveReady(true);
			} else {
				frame = this.target.requestAnimationFrame(check);
			}
		};
		const onMessage = (event: MessageEvent) => {
			const data = event.data;
			if (event.source !== this.target.parent || data?.action !== 'docs:height:applied'
				|| data.session !== this.session || data.id !== id || settled) return;
			if (!data.accepted) release();
			else check();
		};
		const request: PreviewRequest = {
			ready,
			closed,
			get released() { return released; },
			release,
			watch: (visible) => {
				stopWatch = this.vue.watch(() => this.vue.toValue(visible), (value) => {
					if (!value) release();
				}, { flush: 'sync' });
			}
		};
		this.requests.add(request);
		if (this.disposed) release();
		else {
			this.target.addEventListener('message', onMessage);
			timer = this.target.setTimeout(() => {
				timer = 0;
				release();
			}, 2000);
			this.post('enable', id, height);
		}
		return request;
	}
}

export const PREVIEW_SERVICE_IMPORT_CODE = 'import * as __docsPreviewVue from "vue"';
export const PREVIEW_SERVICE_USE_CODE = [
	`;const __docsPlayground=new (${PlaygroundService.toString()})(window,__docsPreviewVue);`,
	'app.provide("docs:playground",__docsPlayground);',
	'window.$docsPlayground=__docsPlayground;',
	'app.mixin({beforeUnmount(){if(this===this.$root)__docsPlayground.dispose()}});'
].join('');
