# @deot/docs-locale

`@deot/docs-locale` 为 Docs Client、Markdown 和 Playground 提供统一的响应式界面翻译能力。内置 `zh-CN` 与 `en-US`，匹配失败或字段缺失时回退到 `en-US`。

## 使用

```ts
import {
	provideLocale,
	resolveLocale,
	useLocale
} from '@deot/docs-locale';

const locale = resolveLocale('zh-CN', {
	'zh-CN': {
		label: '简体中文',
		client: {
			search: { placeholder: '搜索文档' }
		}
	}
});

provideLocale(locale);
const { lang, t } = useLocale();
t('client.search.placeholder');
t('client.database.records', { count: 20 });
```

每个 key 的第一段必须是实际渲染界面的包：`client.*`、`markdown.*` 或 `playground.*`。缺少插值参数时保留原占位符；English 中也不存在的 key 返回 key 本身。

`createLocale(name, partial)` 可创建以 English 补齐的独立语言对象；`resolveLocale(lang, locales)` 还会处理大小写、下划线以及 `zh` / `en` 别名。这些操作不会修改内置字典或用户配置。

## 公共导出

- 语言：`enUS`、`zhCN`。
- 构建：`createLocale`、`resolveLocale`、`buildTranslator`、`buildLocaleContext`。
- Vue：`provideLocale`、`useLocale`、`localeContextKey`。
- 类型：`Language`、`DocsLocaleEntry`、`DocsLocaleMessages`、`LocaleKey`、`Translator` 等。

## 许可证

MIT
