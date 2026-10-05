/** 只在桥接 iframe 内部转发，保证父页面收到的 source 是该 iframe。 */
export const LOCAL_BRIDGE_CHANNEL = 'docs:local-out';

const BRIDGE_INSTALLER = `
if (!window.__docsLocalBridge) {
	window.__docsLocalBridge = true;
	window.addEventListener('message', function (event) {
		var data = event.data;
		if (!data || data.channel !== ${JSON.stringify(LOCAL_BRIDGE_CHANNEL)}) return;
		window.parent.postMessage(data.payload, '*');
	});
}
`;

export const LOCAL_BRIDGE_SRCDOC = `<!doctype html><html><head></head><body><script>${BRIDGE_INSTALLER}</script></body></html>`;

type BridgeWindow = Window & {
	__docsLocalBridge?: boolean;
	eval: (code: string) => unknown;
};

/**
 * 在同源空白 iframe 里安装转发脚本。调用发生在 iframe realm，父页面看到的 source 才是它。
 * @param iframe 用作消息身份的空白 iframe。
 * @returns 脚本是否已经装上。
 */
export const installLocalBridge = (iframe: HTMLIFrameElement) => {
	const win = iframe.contentWindow as BridgeWindow | null;
	if (!win || win.__docsLocalBridge) return Boolean(win?.__docsLocalBridge);
	win.eval(BRIDGE_INSTALLER);
	return Boolean(win.__docsLocalBridge);
};

type PortListener = (event: MessageEvent) => void;

/**
 * 满足 PlaygroundService 现有 Window 调用的预览窗口。
 * 出站消息经 iframe 转发，入站回复再交回服务，协议仍是 docs:height / docs:navigate。
 */
export class LocalPreviewPort {
	readonly parent: { postMessage: (data: unknown, targetOrigin?: string) => void };
	private readonly listeners = new Map<PortListener, EventListener>();

	constructor(private readonly iframe: HTMLIFrameElement) {
		this.parent = {
			postMessage: (data: unknown) => {
				this.iframe.contentWindow?.postMessage({
					channel: LOCAL_BRIDGE_CHANNEL,
					payload: data
				}, '*');
			}
		};
	}

	get contentWindow() {
		return this.iframe.contentWindow;
	}

	get innerHeight() {
		const fromWindow = this.iframe.contentWindow?.innerHeight ?? 0;
		if (fromWindow > 0) return fromWindow;
		return this.iframe.clientHeight || this.iframe.parentElement?.clientHeight || 0;
	}

	addEventListener(type: string, listener: PortListener) {
		const win = this.iframe.contentWindow;
		if (!win) return;
		if (type !== 'message') {
			win.addEventListener(type, listener as EventListener);
			return;
		}
		const wrapped: EventListener = (event) => {
			const message = event as MessageEvent;
			const data = message.data as { channel?: string } | null;
			if (data && data.channel === LOCAL_BRIDGE_CHANNEL) return;
			listener({ data: message.data, source: this.parent } as MessageEvent);
		};
		this.listeners.set(listener, wrapped);
		win.addEventListener('message', wrapped);
	}

	removeEventListener(type: string, listener: PortListener) {
		const win = this.iframe.contentWindow;
		if (!win) return;
		const wrapped = this.listeners.get(listener);
		if (wrapped) {
			this.listeners.delete(listener);
			win.removeEventListener(type, wrapped);
			return;
		}
		win.removeEventListener(type, listener as EventListener);
	}

	requestAnimationFrame(callback: FrameRequestCallback) {
		return window.requestAnimationFrame(callback);
	}

	cancelAnimationFrame(handle: number) {
		window.cancelAnimationFrame(handle);
	}

	setTimeout(handler: TimerHandler, timeout?: number, ...args: unknown[]) {
		return window.setTimeout(handler, timeout, ...args);
	}

	clearTimeout(handle: number) {
		window.clearTimeout(handle);
	}
}
