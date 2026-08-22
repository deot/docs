import type { ComputedRef, Ref } from 'vue';

export interface ClientLocaleMessages {
	common: Record<string, string>;
	footer: Record<string, string>;
	header: Record<string, string>;
	home: Record<string, string>;
	demos: Record<string, string>;
	search: Record<string, string>;
	database: Record<string, string>;
	playgroundResource: Record<string, string>;
	paging: Record<string, string>;
}

export interface MarkdownLocaleMessages {
	indicator: Record<string, string>;
}

export interface PlaygroundLocaleMessages {
	common: Record<string, string>;
	runtime: Record<string, string>;
	files: Record<string, string>;
	editor: Record<string, string>;
	validation: Record<string, string>;
}

export interface RendererLocaleMessages {
	common: Record<string, string>;
	modules: Record<string, string>;
	inspector: Record<string, string>;
	editor: Record<string, string>;
	canvas: Record<string, string>;
	json: Record<string, string>;
}

export interface DocsLocaleMessages {
	client: ClientLocaleMessages;
	markdown: MarkdownLocaleMessages;
	playground: PlaygroundLocaleMessages;
	renderer: RendererLocaleMessages;
}

export interface Language extends DocsLocaleMessages {
	/**
	 * 最终生效的规范化 UI 语言代码。
	 */
	name: string;
}

export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends object
		? DeepPartial<T[P]>
		: T[P];
};

export type DocsLocaleEntry = {
	/**
	 * Header 展示名称，不进入翻译字典。
	 */
	label: string;
} & DeepPartial<DocsLocaleMessages>;

export type LocaleNamespace = 'client' | 'markdown' | 'playground' | 'renderer';
export type LocaleKey = `${LocaleNamespace}.${string}`;
export type TranslatorOption = Record<string, string | number>;
export type Translator = (path: LocaleKey, options?: TranslatorOption) => string;

export interface LocaleContext {
	/**
	 * 当前语言包，含 `name` 与各命名空间文案。
	 */
	locale: Ref<Language>;
	/**
	 * 当前 UI 语言代码，等于 `locale.value.name`。
	 */
	lang: ComputedRef<string>;
	t: Translator;
}
