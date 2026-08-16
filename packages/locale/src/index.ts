import { computed, inject, isRef, provide, ref, unref } from 'vue';
import type { App, InjectionKey, MaybeRef, Ref } from 'vue';
import enUS from './lang/en-US';
import zhCN from './lang/zh-CN';
import type {
	DeepPartial,
	DocsLocaleEntry,
	DocsLocaleMessages,
	Language,
	LocaleContext,
	LocaleKey,
	Translator,
	TranslatorOption
} from './types';

export * from './types';
export { enUS, zhCN };

const NAMESPACES = new Set(['client', 'markdown', 'playground', 'renderer']);

const cloneMerge = (base: unknown, override: unknown): unknown => {
	if (!base || typeof base !== 'object' || Array.isArray(base)) return override ?? base;
	const result: Record<string, unknown> = { ...base };
	if (!override || typeof override !== 'object' || Array.isArray(override)) return result;
	for (const [key, value] of Object.entries(override)) {
		result[key] = value && typeof value === 'object' && !Array.isArray(value)
			? cloneMerge(result[key], value)
			: value;
	}
	return result;
};

const LOCALE_ALIASES: Record<string, string> = {
	'zh': 'zh-CN',
	'zh-cn': 'zh-CN',
	'en': 'en-US',
	'en-us': 'en-US'
};
const normalizeLocale = (value = '') => {
	const name = value.trim().replace(/_/gu, '-');
	return LOCALE_ALIASES[name.toLowerCase()] || name;
};

const withoutLabel = (entry?: DocsLocaleEntry): DeepPartial<DocsLocaleMessages> => {
	if (!entry) return {};
	const messages = { ...entry } as Partial<DocsLocaleEntry>;
	delete messages.label;
	return messages;
};

export const createLocale = (
	name: string,
	messages: DeepPartial<DocsLocaleMessages> = {}
): Language => ({
	...cloneMerge(enUS, messages) as Language,
	name: normalizeLocale(name)
});

export const resolveLocale = (
	lang?: string,
	locales: Record<string, DocsLocaleEntry> = {}
): Language => {
	const requested = normalizeLocale(lang);
	if (!requested) return createLocale(enUS.name);
	const matched = Object.entries(locales)
		.find(([name]) => normalizeLocale(name).toLowerCase() === requested.toLowerCase());
	const name = matched ? normalizeLocale(matched[0]) : requested;
	if (!matched && name !== zhCN.name && name !== enUS.name) return createLocale(enUS.name);
	const builtin = name === zhCN.name ? zhCN : enUS;
	return createLocale(
		name,
		cloneMerge(builtin, withoutLabel(matched?.[1])) as DeepPartial<DocsLocaleMessages>
	);
};

const translate = (path: LocaleKey, options: TranslatorOption | undefined, locale: Language) => {
	const parts = path.split('.');
	if (!NAMESPACES.has(parts[0])) return path;
	let value: unknown = locale;
	for (const part of parts) {
		if (!value || typeof value !== 'object') return path;
		value = (value as Record<string, unknown>)[part];
	}
	if (typeof value !== 'string') return path;
	return value.replace(/\{(\w+)\}/gu, (_, key: string) => `${options?.[key] ?? `{${key}}`}`);
};

export const buildTranslator = (locale: MaybeRef<Language>): Translator =>
	(path, options) => translate(path, options, unref(locale));

export const buildLocaleContext = (locale: MaybeRef<Language>): LocaleContext => {
	const localeRef = (isRef(locale) ? locale : ref(locale)) as Ref<Language>;
	return {
		locale: localeRef,
		lang: computed(() => localeRef.value.name),
		t: buildTranslator(localeRef)
	};
};

export const localeContextKey: InjectionKey<Ref<Language | undefined>> = Symbol('docsLocaleContextKey');

export const provideLocale = (locale: MaybeRef<Language | undefined>, app?: App) => {
	const localeRef = (isRef(locale) ? locale : ref(locale)) as Ref<Language | undefined>;
	if (app) app.provide(localeContextKey, localeRef);
	else provide(localeContextKey, localeRef);
	return localeRef;
};

export const useLocale = (override?: MaybeRef<Language | undefined>): LocaleContext => {
	const inherited = inject(localeContextKey, ref<Language>());
	const locale = computed(() => unref(override) || inherited.value || enUS) as Ref<Language>;
	return buildLocaleContext(locale);
};
