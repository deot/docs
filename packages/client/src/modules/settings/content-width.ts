import { readonly, ref } from 'vue';
import { getDocsNamespace } from '../../utils/resolver';
import type { DocsConfig } from '../../types';

export const CONTENT_WIDTHS = ['regular', 'wide', 'full'] as const;

export type DocsContentWidth = (typeof CONTENT_WIDTHS)[number];

export const DEFAULT_CONTENT_WIDTH: DocsContentWidth = 'wide';

const SETTING_KEY = 'contentWidth';

interface SettingsAccess {
	get<T>(namespace: string, key: string): Promise<T | null>;
	set<T>(namespace: string, key: string, value: T): Promise<void>;
}

export const isDocsContentWidth = (value: unknown): value is DocsContentWidth => (
	value === 'regular' || value === 'wide' || value === 'full'
);

/**
 * 管理 Markdown 正文宽度，并按站点 namespace 持久化到设置库。
 */
export class ContentWidthSettingsManager {
	private value = ref<DocsContentWidth>(DEFAULT_CONTENT_WIDTH);
	private namespace = '';
	private session = 0;
	private preferenceVersion = 0;
	private active = false;

	readonly current = readonly(this.value);

	constructor(private settings: SettingsAccess) {}

	start(config: DocsConfig) {
		const session = ++this.session;
		const preferenceVersion = ++this.preferenceVersion;
		this.active = true;
		this.namespace = getDocsNamespace(config);
		this.value.value = DEFAULT_CONTENT_WIDTH;
		void this.restore(session, preferenceVersion, this.namespace);
		return () => this.stop(session);
	}

	private stop(session: number) {
		if (session !== this.session) return;
		this.session++;
		this.active = false;
	}

	private async restore(session: number, preferenceVersion: number, namespace: string) {
		let stored: unknown;
		try {
			stored = await this.settings.get(namespace, SETTING_KEY);
		} catch {
			// IndexedDB 不可用时保留默认超宽宽度。
		}
		if (
			isDocsContentWidth(stored)
			&& session === this.session
			&& preferenceVersion === this.preferenceVersion
		) {
			this.value.value = stored;
		}
	}

	async set(next: DocsContentWidth) {
		if (!isDocsContentWidth(next) || next === this.value.value) return;
		// 用户操作必须让尚未完成的 IndexedDB 恢复失效，避免旧设置覆盖刚完成的选择。
		this.preferenceVersion++;
		this.value.value = next;
		if (!this.active) return;
		try {
			await this.settings.set(this.namespace, SETTING_KEY, next);
		} catch {
			// 持久化失败不影响当前会话的宽度切换。
		}
	}
}
