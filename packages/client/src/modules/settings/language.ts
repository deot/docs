import { getDocsNamespace } from '../../utils/resolver';
import type { DocsConfig } from '../../types';

interface SettingsAccess {
	get<T>(namespace: string, key: string): Promise<T | null>;
	set<T>(namespace: string, key: string, value: T): Promise<void>;
}

const SETTING_KEY = 'language';

const isConfiguredLanguage = (config: DocsConfig, language: unknown): language is string => (
	typeof language === 'string'
	&& Object.prototype.hasOwnProperty.call(config.locales, language)
);

export class LanguageSettingsManager {
	constructor(private settings: SettingsAccess) {}

	/**
	 * 从站点级设置恢复最近一次有效语言。
	 * @param config 文档站配置。
	 * @returns 已配置的持久化语言；没有有效设置时返回 undefined。
	 */
	async restore(config: DocsConfig) {
		try {
			const language = await this.settings.get<unknown>(
				getDocsNamespace(config),
				SETTING_KEY
			);
			return isConfiguredLanguage(config, language) ? language : undefined;
		} catch {
			// IndexedDB 不可用时继续使用默认语言。
			return undefined;
		}
	}

	/**
	 * 保存有效语言；无效路由参数不会污染用户设置。
	 * @param config 文档站配置。
	 * @param language 待保存的路由语言参数。
	 */
	async persist(config: DocsConfig, language: unknown) {
		if (!isConfiguredLanguage(config, language)) return;
		try {
			await this.settings.set(getDocsNamespace(config), SETTING_KEY, language);
		} catch {
			// 持久化失败不影响当前路由。
		}
	}
}
