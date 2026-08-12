import { readonly, ref } from 'vue';
import { isDocsTheme } from '@deot/docs-theme';
import { Settings } from '../settings';
import { getDocsNamespace } from '../../utils/resolver';
import type {
	DocsConfig,
	DocsTheme,
	DocsThemeController
} from '../../types';
import type { DocsThemePreference } from '@deot/docs-theme';

interface ViewTransitionLike {
	ready: Promise<void>;
	finished: Promise<void>;
}

type ThemeDocument = Document & {
	startViewTransition?: (callback: () => void | Promise<void>) => ViewTransitionLike;
};

interface ThemeRequest {
	theme: DocsTheme;
	origin?: HTMLElement;
	namespace: string;
	session: number;
}

/** 管理主题解析、DOM 同步、系统监听和用户设置持久化。 */
class ThemeManager implements DocsThemeController {
	private value = ref<DocsTheme>('light');
	private enabledValue = ref(true);
	private readyValue = ref(false);
	private active = false;
	private namespace = '';
	private media?: MediaQueryList;
	private session = 0;
	private preferenceVersion = 0;
	private followingSystem = false;
	private target?: Window;
	private appliedTarget?: Window;
	private appliedTheme?: DocsTheme;
	private operation?: Promise<void>;
	private queued?: ThemeRequest;
	private requested?: DocsTheme;

	readonly current = readonly(this.value);
	readonly enabled = readonly(this.enabledValue);
	readonly ready = readonly(this.readyValue);

	private normalizeDefault(config: DocsConfig): DocsThemePreference {
		if (!config.theme || config.theme === true) return 'system';
		const value = config.theme.default;
		return isDocsTheme(value) || value === 'system' ? value : 'system';
	}

	private getSystemTheme() {
		return this.target?.matchMedia?.('(prefers-color-scheme: dark)').matches
			? 'dark'
			: 'light';
	}

	private resolveInitialTheme(config: DocsConfig): {
		followingSystem: boolean;
		theme: DocsTheme;
	} {
		const document = this.target?.document;
		const body = document?.body;
		const documentElement = document?.documentElement;
		const declaredTheme = [
			body?.getAttribute('data-doc-theme'),
			body?.getAttribute('data-vc-theme'),
			documentElement?.getAttribute('data-doc-theme'),
			documentElement?.getAttribute('data-vc-theme')
		].find(isDocsTheme);
		// 同一个 Window 重新启动时，DOM 上可能仍保留上一会话由本实例写入的属性；
		// 它不属于宿主的初始声明，不能覆盖新 namespace 的默认值或持久化设置。
		const managedDeclaration = this.appliedTarget === this.target
			&& declaredTheme === this.appliedTheme;
		if (declaredTheme && !managedDeclaration) {
			return { followingSystem: false, theme: declaredTheme };
		}
		const preference = this.normalizeDefault(config);
		return preference === 'system'
			? { followingSystem: true, theme: this.getSystemTheme() }
			: { followingSystem: false, theme: preference };
	}

	private apply(theme: DocsTheme) {
		this.value.value = theme;
		this.appliedTarget = this.target;
		this.appliedTheme = theme;
		const document = this.target?.document;
		const body = document?.body;
		const documentElement = document?.documentElement;
		if (!body || !documentElement) return;
		body.setAttribute('data-doc-theme', theme);
		body.setAttribute('data-vc-theme', theme);
		documentElement.setAttribute('data-doc-theme', theme);
		documentElement.setAttribute('data-vc-theme', theme);
		documentElement.style.colorScheme = theme;
	}

	private detachSystemListener() {
		if (!this.media) return;
		this.media.removeEventListener('change', this.handleSystemChange);
		this.media = undefined;
	}

	private attachSystemListener() {
		this.detachSystemListener();
		if (!this.target?.matchMedia || !this.followingSystem) return;
		this.media = this.target.matchMedia('(prefers-color-scheme: dark)');
		this.media.addEventListener('change', this.handleSystemChange);
	}

	private handleSystemChange = (event: MediaQueryListEvent) => {
		if (!this.followingSystem) return;
		const theme = event.matches ? 'dark' : 'light';
		this.requested = theme;
		this.apply(theme);
	};

	private shouldAnimate() {
		return Boolean(
			(this.target?.document as ThemeDocument | undefined)?.startViewTransition
			&& !this.target?.matchMedia?.('(prefers-reduced-motion: reduce)').matches
		);
	}

	private resolveTransitionPoint(origin?: HTMLElement) {
		const document = this.target?.document;
		const candidates = [
			origin,
			...Array.from(document?.querySelectorAll<HTMLElement>('.theme-toggler') || [])
		].filter((item, index, items): item is HTMLElement => Boolean(
			item
			&& typeof item.getBoundingClientRect === 'function'
			&& items.indexOf(item) === index
		));
		for (const candidate of candidates) {
			const rect = candidate.getBoundingClientRect();
			if (rect.width > 0 && rect.height > 0) {
				return {
					x: rect.left + rect.width / 2,
					y: rect.top + rect.height / 2
				};
			}
		}
		return null;
	}

	private async applyWithTransition(theme: DocsTheme, origin: HTMLElement | undefined, session: number) {
		const document = this.target?.document as ThemeDocument | undefined;
		const point = this.resolveTransitionPoint(origin);
		// 没有可见触发源时直接切换，避免首屏初始化错误地从视口中心扩散。
		if (!document || !this.shouldAnimate() || !point) {
			if (session === this.session) this.apply(theme);
			return;
		}
		const { x, y } = point;
		const radius = Math.hypot(
			Math.max(x, this.target!.innerWidth - x),
			Math.max(y, this.target!.innerHeight - y)
		);
		const ratioX = 100 * x / this.target!.innerWidth;
		const ratioY = 100 * y / this.target!.innerHeight;
		const referenceRadius = Math.hypot(
			this.target!.innerWidth,
			this.target!.innerHeight
		) / Math.SQRT2;
		const ratioRadius = 100 * radius / referenceRadius;
		const transition = document.startViewTransition!(async () => {
			if (session === this.session) this.apply(theme);
		});
		try {
			await transition.ready;
			const clipPath = [
				`circle(0% at ${ratioX}% ${ratioY}%)`,
				`circle(${ratioRadius}% at ${ratioX}% ${ratioY}%)`
			];
			document.documentElement.animate(
				{ clipPath },
				{
					duration: 400,
					easing: 'ease-in',
					fill: 'both',
					pseudoElement: '::view-transition-new(root)'
				} as KeyframeAnimationOptions
			);
			await transition.finished;
		} catch {
			// View Transition 被浏览器取消时主题已经写入，无需回滚用户选择。
		}
	}

	private async restore(session: number, preferenceVersion: number, namespace: string) {
		try {
			const stored = await Settings.get<unknown>(namespace, 'theme');
			if (session !== this.session || preferenceVersion !== this.preferenceVersion) return;
			if (isDocsTheme(stored)) {
				this.followingSystem = false;
				this.detachSystemListener();
				this.requested = stored;
				this.apply(stored);
			}
		} catch {
			// IndexedDB 不可用时保留同步解析出的主题，不阻断应用启动。
		} finally {
			if (session === this.session) this.readyValue.value = true;
		}
	}

	start(config: DocsConfig, target: Window = window) {
		const session = ++this.session;
		const preferenceVersion = ++this.preferenceVersion;
		this.target = target;
		this.active = true;
		this.queued = undefined;
		this.requested = undefined;
		this.readyValue.value = false;
		this.enabledValue.value = config.theme !== false;
		this.detachSystemListener();
		if (!this.enabledValue.value) {
			this.readyValue.value = true;
			return () => this.stop(session);
		}
		this.namespace = getDocsNamespace(config);
		const initial = this.resolveInitialTheme(config);
		this.followingSystem = initial.followingSystem;
		this.apply(initial.theme);
		this.attachSystemListener();
		this.requested = initial.theme;
		void this.restore(session, preferenceVersion, this.namespace);
		return () => this.stop(session);
	}

	private stop(session: number) {
		if (session !== this.session) return;
		this.session++;
		this.active = false;
		this.enabledValue.value = false;
		this.readyValue.value = false;
		this.queued = undefined;
		this.requested = undefined;
		this.detachSystemListener();
	}

	private async flush(session: number) {
		while (this.queued?.session === session) {
			const request = this.queued;
			this.queued = undefined;
			if (request.theme !== this.value.value) {
				await this.applyWithTransition(request.theme, request.origin, session);
			}
			if (session !== this.session) return;
			try {
				await Settings.set(request.namespace, 'theme', request.theme);
			} catch {
				// 持久化失败不撤销当前会话中已经完成的主题切换。
			}
		}
		if (session === this.session) this.requested = this.value.value;
	}

	private async ensureFlush(session: number) {
		while (this.queued?.session === session) {
			if (this.operation) {
				await this.operation;
				continue;
			}
			const operation = this.flush(session);
			this.operation = operation;
			try {
				await operation;
			} finally {
				if (this.operation === operation) this.operation = undefined;
			}
		}
	}

	async set(theme: DocsTheme, origin?: HTMLElement) {
		if (!this.active || !this.enabledValue.value || !isDocsTheme(theme)) return;
		const session = this.session;
		if (theme === (this.requested || this.value.value)) return;
		// 用户操作必须让尚未完成的 IndexedDB 恢复失效，避免旧设置覆盖刚完成的选择。
		this.preferenceVersion++;
		this.followingSystem = false;
		this.detachSystemListener();
		this.requested = theme;
		this.queued = {
			theme,
			origin,
			namespace: this.namespace,
			session
		};
		await this.ensureFlush(session);
	}

	toggle(origin?: HTMLElement) {
		return this.set((this.requested || this.value.value) === 'dark' ? 'light' : 'dark', origin);
	}
}

const manager = new ThemeManager();

/** 自定义 Header 与内置切换器共用的主题控制器。 */
export const Theme: DocsThemeController = manager;

/** Client 启动流程使用同一实例初始化主题会话。 */
export const ThemeRuntime = manager;
