import { IndexedDBStore } from '@deot/helper-cache';
import { ContentWidthSettingsManager } from './content-width';
import { LanguageSettingsManager } from './language';
import { ThemeSettingsManager } from './theme';

interface SettingRecord<T = unknown> {
	id: string;
	namespace: string;
	key: string;
	value: T;
	updatedAt: number;
}

/**
 * 使用独立数据库保存按文档站点隔离的界面设置。
 */
class SettingsManager {
	private store = new IndexedDBStore({
		name: 'deot-docs-settings',
		storeName: 'settings',
		keyPath: '__id',
		version: 1
	});

	readonly language = new LanguageSettingsManager(this);
	readonly theme = new ThemeSettingsManager(this);
	readonly contentWidth = new ContentWidthSettingsManager(this);

	private createId(namespace: string, key: string) {
		return [namespace, key].map(encodeURIComponent).join('|');
	}

	private isRecord(value: unknown): value is SettingRecord {
		if (!value || typeof value !== 'object') return false;
		const record = value as Partial<SettingRecord>;
		return typeof record.id === 'string'
			&& typeof record.namespace === 'string'
			&& typeof record.key === 'string'
			&& typeof record.updatedAt === 'number'
			&& Object.prototype.hasOwnProperty.call(record, 'value');
	}

	async get<T>(namespace: string, key: string): Promise<T | null> {
		const value = await this.store.get(this.createId(namespace, key));
		return this.isRecord(value) ? value.value as T : null;
	}

	async set<T>(namespace: string, key: string, value: T) {
		const id = this.createId(namespace, key);
		await this.store.set(id, {
			id,
			key,
			namespace,
			updatedAt: Date.now(),
			value
		} satisfies SettingRecord<T>);
	}

	async remove(namespace: string, key: string) {
		await this.store.remove(this.createId(namespace, key));
	}
}

/**
 * Client 内所有界面设置共用的持久化实例。
 */
export const Settings = new SettingsManager();

/**
 * 自定义 Header 与内置切换器共用的主题控制器。
 */
export const Theme = Settings.theme;

/**
 * Client 启动流程使用同一实例初始化主题会话。
 */
export const ThemeRuntime = Settings.theme;

/**
 * Markdown 正文宽度切换器与启动流程共用的控制器。
 */
export const ContentWidth = Settings.contentWidth;

/**
 * Client 启动流程使用同一实例恢复并持久化正文宽度。
 */
export const ContentWidthRuntime = Settings.contentWidth;

export {
	CONTENT_WIDTHS,
	isDocsContentWidth
} from './content-width';
export type { DocsContentWidth } from './content-width';
