<template>
	<div class="docs-markdown">
		<MarkdownIndicator
			v-if="indicatorOptions"
			:target="content"
			:options="indicatorOptions"
		/>
		<div ref="content" class="docs-markdown-reset" v-markdown="markdownBinding"></div>
	</div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { provideLocale, useLocale } from '@deot/docs-locale';
import type { Language } from '@deot/docs-locale';
import { vMarkdown } from './directive';
import MarkdownIndicator from './indicator.vue';
import type { MarkdownIndicatorConfig } from './types';

// 后续再处理内容变更。
defineEmits<{
	'update:modelValue': [value: string];
	'change': [value: string];
}>();
const props = withDefaults(defineProps<{
	indicator?: MarkdownIndicatorConfig;
	locale?: Language;
	modelValue?: string;
	value?: string;
}>(), {
	indicator: true
});

const content = ref<HTMLElement>();
const inheritedLocale = useLocale();
const locale = computed(() => props.locale || inheritedLocale.locale.value);
provideLocale(locale);
const indicatorOptions = computed(() => {
	if (props.indicator === false) return undefined;
	return typeof props.indicator === 'object' ? props.indicator : {};
});

// 即使 modelValue 是合法的空文档，它仍然是唯一可信的数据源。
const source = computed(() => typeof props.modelValue === 'string'
	? props.modelValue
	: props.value);
const markdownBinding = computed(() => ({ source: source.value, locale: locale.value }));
</script>
<style lang="scss">
@use '@deot/style/src/mixins/bem' as *;
@use '../node_modules/@deot/docs-theme/src/variables';

*,
*::before,
*::after {
	box-sizing: border-box;
}

a {
	color: var(--docs-foreground-color, var(--vc-foreground-color, #333));
	text-decoration: none;
}

ul,
li {
	padding: 0;
	list-style: none;
}

h1 .header-anchor,
h2 .header-anchor,
h3 .header-anchor,
h4 .header-anchor,
h5 .header-anchor,
h6 .header-anchor {
	float: left;
	margin-right: 5px;
	margin-left: -15px;
	color: inherit;
	text-decoration: none;
	opacity: 0;
	transition: opacity 0.2s ease;
}

h1:hover .header-anchor,
h2:hover .header-anchor,
h3:hover .header-anchor,
h4:hover .header-anchor,
h5:hover .header-anchor,
h6:hover .header-anchor,
.header-anchor:focus-visible {
	opacity: 1;
}

$sign: md;

@include block(docs-markdown) {
	position: relative;
}

@include block(docs-markdown-reset) {
	font-family:
		-apple-system,
		BlinkMacSystemFont,
		"Segoe UI",
		Helvetica,
		Arial,
		sans-serif,
		"Apple Color emoji",
		"Segoe UI emoji",
		"Segoe UI Symbol";
	font-size: 13px;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
	line-height: 1.65;
	color: var(--docs-foreground-color-light, var(--vc-color-dark-lighter, #515a6e));
	overflow-wrap: break-word;
}

@include block(docs-markdown-code-preview) {
	margin-bottom: 16px;
}

@include block(docs-markdown-reset) {
	ol[#{$sign}], ul[#{$sign}], li[#{$sign}] {
		list-style: unset;
	}

	ul[#{$sign}] {
		list-style-type: disc;
	}

	ol[#{$sign}] {
		list-style-type: decimal;
	}

	&::before {
		display: table;
		content: "";
	}

	&::after {
		display: table;
		clear: both;
		content: "";
	}

	&>*[#{$sign}]:first-child {
		margin-top: 0 !important;
	}

	&>*[#{$sign}]:last-child {
		margin-bottom: 0 !important;
	}

	& a[#{$sign}]:not([href]) {
		color: inherit;
		text-decoration: none;
	}

	& .absent[#{$sign}] {
		color: var(--vc-color-error, #cb2431);
	}

	& .anchor[#{$sign}] {
		float: left;
		padding-right: 6px;
		margin-left: -20px;
		line-height: 1;
		color: inherit;
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	& .anchor i[#{$sign}] {
		font-size: 18px;
	}

	& .anchor[#{$sign}]:focus {
		outline: none;
	}

	& p[#{$sign}],
	& blockquote[#{$sign}],
	& ul[#{$sign}],
	& ol[#{$sign}],
	& dl[#{$sign}],
	& table[#{$sign}],
	& pre[#{$sign}] {
		margin-top: 0;
		margin-bottom: 18px;
	}

	& hr[#{$sign}] {
		height: 1px;
		padding: 0;
		margin: 28px 0;
		background-color: var(--docs-border-color, #e1e4e8);
		border: 0;
	}

	& blockquote[#{$sign}] {
		padding: 4px 0 4px 12px;
		margin-right: 0;
		margin-left: 0;
		color: var(--docs-foreground-color-mute, #6a737d);
		background-color: transparent;
		border-left: 3px solid var(--docs-border-color, #dfe2e5);
	}

	& blockquote[#{$sign}]>:first-child {
		margin-top: 0;
	}

	& blockquote[#{$sign}]>:last-child {
		margin-bottom: 0;
	}

	& kbd[#{$sign}] {
		display: inline-block;
		padding: 3px 5px;
		font-size: 11px;
		line-height: 10px;
		color: var(--docs-foreground-color-light, #444d56);
		vertical-align: middle;
		background-color: var(--docs-background-color-soft, #fafbfc);
		border: solid 1px var(--docs-border-color, #c6cbd1);
		border-bottom-color: var(--docs-foreground-color-mute, #959da5);
		border-radius: 3px;
		box-shadow: inset 0 -1px 0 var(--docs-foreground-color-mute, #959da5);
	}

	& h1[#{$sign}],
	& h2[#{$sign}],
	& h3[#{$sign}],
	& h4[#{$sign}],
	& h5[#{$sign}],
	& h6[#{$sign}] {
		margin-top: 28px;
		margin-bottom: 12px;
		font-weight: 650;
		line-height: 1.35;
		color: var(--docs-foreground-color, var(--vc-foreground-color, #24292f));
		scroll-margin-top: 80px;
	}

	& h1[#{$sign}],
	& h2[#{$sign}],
	& h3[#{$sign}] {
		text-wrap: balance;
	}

	& h1 .octicon-link[#{$sign}],
	& h2 .octicon-link[#{$sign}],
	& h3 .octicon-link[#{$sign}],
	& h4 .octicon-link[#{$sign}],
	& h5 .octicon-link[#{$sign}],
	& h6 .octicon-link[#{$sign}] {
		color: var(--docs-foreground-color, #1b1f23);
		vertical-align: middle;
		visibility: hidden;
	}

	& h1:hover .anchor[#{$sign}],
	& h2:hover .anchor[#{$sign}],
	& h3:hover .anchor[#{$sign}],
	& h4:hover .anchor[#{$sign}],
	& h5:hover .anchor[#{$sign}],
	& h6:hover .anchor[#{$sign}] {
		text-decoration: none;
		opacity: 1;
	}

	& h1:hover .anchor .octicon-link[#{$sign}],
	& h2:hover .anchor .octicon-link[#{$sign}],
	& h3:hover .anchor .octicon-link[#{$sign}],
	& h4:hover .anchor .octicon-link[#{$sign}],
	& h5:hover .anchor .octicon-link[#{$sign}],
	& h6:hover .anchor .octicon-link[#{$sign}] {
		visibility: visible;
	}

	& h1 tt[#{$sign}],
	& h1 code[#{$sign}],
	& h2 tt[#{$sign}],
	& h2 code[#{$sign}],
	& h3 tt[#{$sign}],
	& h3 code[#{$sign}],
	& h4 tt[#{$sign}],
	& h4 code[#{$sign}],
	& h5 tt[#{$sign}],
	& h5 code[#{$sign}],
	& h6 tt[#{$sign}],
	& h6 code[#{$sign}]
{
		font-size: inherit;
	}

	& h1[#{$sign}] {
		padding-bottom: 0.4em;
		font-size: 2.05em;
		border-bottom: 1px solid var(--docs-border-color, #eaecef);
	}

	& h2[#{$sign}] {
		padding-bottom: 0.4em;
		font-size: 1.6em;
		border-bottom: 1px solid var(--docs-border-color, #eaecef);
	}

	& h3[#{$sign}] {
		font-size: 1.3em;
	}

	& h4[#{$sign}] {
		font-size: 1.1em;
	}

	& h5[#{$sign}] {
		font-size: 1em;
	}

	& h6[#{$sign}] {
		font-size: 0.9em;
		color: var(--docs-foreground-color-mute, #6a737d);
	}

	& strong[#{$sign}] {
		font-weight: 650;
		color: var(--docs-foreground-color, var(--vc-foreground-color, #24292f));
	}

	& del[#{$sign}] {
		opacity: 0.72;
	}

	& ul[#{$sign}],
	& ol[#{$sign}] {
		padding-left: 1.75em;
	}

	& ul.no-list[#{$sign}],
	& ol.no-list[#{$sign}] {
		padding: 0;
		list-style-type: none;
	}

	& ul ul[#{$sign}],
	& ul ol[#{$sign}],
	& ol ol[#{$sign}],
	& ol ul[#{$sign}] {
		margin-top: 0;
		margin-bottom: 0;
	}

	& li[#{$sign}] {
		overflow-wrap: break-word;
	}

	& li[#{$sign}]::marker {
		font-weight: 600;
		color: inherit;
	}

	& li>p[#{$sign}] {
		margin-top: 16px;
	}

	& li+li[#{$sign}] {
		margin-top: 0.25em;
	}

	& dl[#{$sign}] {
		padding: 0;
	}

	& dl dt[#{$sign}] {
		padding: 0;
		margin-top: 16px;
		font-size: 1em;
		font-style: italic;
		font-weight: 600;
	}

	& dl dd[#{$sign}] {
		padding: 0 16px;
		margin-bottom: 16px;
	}

	& table[#{$sign}] {
		display: block;
		width: fit-content;
		max-width: 100%;
		overflow: auto;
		border: 1px solid var(--docs-border-color, #dfe2e5);
		border-collapse: separate;
		border-spacing: 0;
		border-radius: 8px;
	}

	& table th[#{$sign}] {
		font-weight: 600;
		white-space: nowrap;
		background-color: var(--docs-background-color-soft, #f7f8fa);
	}

	& table th[#{$sign}],
	& table td[#{$sign}] {
		padding: 8px 12px;
		vertical-align: top;
		border-right: 1px solid var(--docs-border-color, #dfe2e5);
		border-bottom: 1px solid var(--docs-border-color, #dfe2e5);
	}

	& table th[#{$sign}]:last-child,
	& table td[#{$sign}]:last-child {
		border-right: 0;
	}

	& table tbody tr:last-child td[#{$sign}] {
		border-bottom: 0;
	}

	& table tr[#{$sign}] {
		background-color: var(--docs-background-color, #fff);
	}

	& table tr[#{$sign}]:nth-child(2n) {
		background-color: var(--docs-code-background, #f6f8fa);
	}

	& table tbody tr[#{$sign}] {
		transition: background-color 0.15s ease;
	}

	& table tbody tr[#{$sign}]:hover {
		background-color: color-mix(
			in srgb,
			var(--docs-primary-color, #873bf4) 7%,
			var(--docs-background-color, #fff)
		);
	}

	& table img[#{$sign}] {
		background-color: transparent;
	}

	& img[#{$sign}] {
		max-width: 100%;
		background-color: var(--docs-background-color, #fff);
		border-radius: 6px;
		box-sizing: content-box;
	}

	& img[align=right][#{$sign}] {
		padding-left: 20px;
	}

	& img[align=left][#{$sign}] {
		padding-right: 20px;
	}

	& .emoji[#{$sign}] {
		max-width: none;
		vertical-align: text-top;
		background-color: transparent;
	}

	& span.frame[#{$sign}] {
		display: block;
		overflow: hidden;
	}

	& span.frame>span[#{$sign}] {
		display: block;
		float: left;
		width: auto;
		padding: 7px;
		margin: 13px 0 0;
		overflow: hidden;
		border: 1px solid var(--docs-border-color, #dfe2e5);
	}

	& span.frame span img[#{$sign}] {
		display: block;
		float: left;
	}

	& span.frame span span[#{$sign}] {
		display: block;
		padding: 5px 0 0;
		clear: both;
		color: var(--docs-foreground-color, #24292e);
	}

	& span.align-center[#{$sign}] {
		display: block;
		overflow: hidden;
		clear: both;
	}

	& span.align-center>span[#{$sign}] {
		display: block;
		margin: 13px auto 0;
		overflow: hidden;
		text-align: center;
	}

	& span.align-center span img[#{$sign}] {
		margin: 0 auto;
		text-align: center;
	}

	& span.align-right[#{$sign}] {
		display: block;
		overflow: hidden;
		clear: both;
	}

	& span.align-right>span[#{$sign}] {
		display: block;
		margin: 13px 0 0;
		overflow: hidden;
		text-align: right;
	}

	& span.align-right span img[#{$sign}] {
		margin: 0;
		text-align: right;
	}

	& span.float-left[#{$sign}] {
		display: block;
		float: left;
		margin-right: 13px;
		overflow: hidden;
	}

	& span.float-left span[#{$sign}] {
		margin: 13px 0 0;
	}

	& span.float-right[#{$sign}] {
		display: block;
		float: right;
		margin-left: 13px;
		overflow: hidden;
	}

	& span.float-right>span[#{$sign}] {
		display: block;
		margin: 13px auto 0;
		overflow: hidden;
		text-align: right;
	}

	& .csv-data td[#{$sign}],
	& .csv-data th[#{$sign}] {
		padding: 5px;
		overflow: hidden;
		font-size: 12px;
		line-height: 1;
		text-align: left;
		white-space: nowrap;
	}

	& .csv-data .blob-num[#{$sign}] {
		padding: 10px 8px 9px;
		text-align: right;
		background: var(--docs-background-color, #fff);
		border: 0;
	}

	& .csv-data tr[#{$sign}] {
		border-top: 0;
	}

	& .csv-data th[#{$sign}] {
		font-weight: 600;
		background: var(--docs-code-background, #f6f8fa);
		border-top: 0;
	}

	// 代码样式
	& code[#{$sign}],
	& tt[#{$sign}] {
		margin: 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.9em;
		border-radius: 4px;
	}

	& code br[#{$sign}],
	& tt br[#{$sign}] {
		display: none;
	}

	& del code[#{$sign}] {
		text-decoration: inherit;
	}

	& pre[#{$sign}] {
		overflow-wrap: normal;
	}

	& .highlight[#{$sign}] {
		margin-bottom: 16px;
	}

	& .highlight pre[#{$sign}] {
		margin-bottom: 0;
		word-break: normal;
	}

	& .highlight pre[#{$sign}] {
		padding: 16px 18px;
		overflow: auto;
		font-size: 0.9em;
		line-height: 1.65;
		background-color: var(--docs-code-background, #f6f8fa);
		border: 1px solid var(--docs-border-color, #eaeefb);
		border-radius: 6px;
	}

	& pre tt[#{$sign}] {
		display: inline;
		max-width: auto;
		padding: 0;
		margin: 0;
		overflow: visible;
		line-height: inherit;
		overflow-wrap: normal;
		background-color: transparent;
		border: 0;
	}

	& .tip[#{$sign}] {
		padding: 10px 14px;
		margin: 20px 0;
		background-color: var(--docs-tip-background, #f9f0ff);
		border-left: 4px solid var(--docs-primary-color, #873bf4);
		border-radius: 6px;

		p {
			margin-bottom: 0;
		}
	}

	& .warning[#{$sign}] {
		padding: 10px 14px;
		margin: 20px 0;
		background-color: var(--docs-warning-background, #fff6f7);
		border-left: 4px solid #fe6c6f;
		border-radius: 6px;

		p {
			margin-bottom: 0;
		}
	}

	& code[#{$sign}]:not(.hljs)  {
		padding: 0.15em 0.4em;
		color: var(--docs-primary-color, #873bf4);
		background-color: var(--docs-code-background, #f9fafc);
		border: 1px solid var(--docs-border-color, #eaeefb);
		border-radius: 4px;
	}

	& .tip[#{$sign}] {
		code:not(.hljs)  {
			color: var(--docs-foreground-color-light, #445368);
			background-color: color-mix(
				in srgb,
				var(--docs-background-color, #fff) 70%,
				transparent
			);
		}
	}

	& a[#{$sign}][href]:not(.header-anchor) {
		color: var(--docs-link-color, #2d8cf0);
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, currentcolor 20%, transparent);
		text-underline-offset: 0.2em;
		transition: color 0.2s ease, text-decoration-color 0.2s ease;
	}

	& a[#{$sign}][href]:not(.header-anchor):hover {
		color: var(
			--docs-link-hover-color,
			color-mix(in srgb, var(--docs-link-color, #2d8cf0) 82%, #000)
		);
		text-decoration-color: color-mix(in srgb, currentcolor 45%, transparent);
	}

	& a[#{$sign}][href]:not(.header-anchor):focus-visible {
		border-radius: 2px;
		outline: 2px solid color-mix(in srgb, var(--docs-link-color, #2d8cf0) 45%, transparent);
		outline-offset: 2px;
	}

	&>details {
		padding: 10px 14px;
		margin-bottom: 18px;
		background-color: var(--docs-background-color-soft, #f7f8fa);
		border: 1px solid var(--docs-border-color, #e1e4e8);
		border-radius: 6px;
	}

	&>details>summary {
		font-weight: 600;
		color: var(--docs-foreground-color, var(--vc-foreground-color, #24292f));
		cursor: pointer;
		transition: color 0.2s ease;
		user-select: none;
	}

	&>details>summary:hover {
		color: var(--docs-link-color, #2d8cf0);
	}

	&>details>summary::marker {
		color: var(--docs-foreground-color-mute, #6a737d);
	}

	&>details[open]>summary {
		margin-bottom: 12px;
	}

	&>details>:last-child {
		margin-bottom: 0;
	}
}

[data-doc-theme='dark'] .docs-markdown-reset,
[data-vc-theme='dark'] .docs-markdown-reset {
	color: var(--docs-foreground-color-light, #d9d9d9);

	hr[md] {
		background-color: var(--docs-border-color, #3b4355);
	}

	blockquote[md] {
		color: var(--docs-foreground-color-mute, #b9b9b9);
		border-left-color: var(--docs-border-color, #3b4355);
	}

	&>details {
		background-color: var(--docs-background-color-soft, #252b3a);
		border-color: var(--docs-border-color, #3b4355);
	}

	kbd[md],
	table tr[md],
	img[md] {
		color: var(--docs-foreground-color-light, #d9d9d9);
		background-color: var(--docs-background-color, #171b24);
		border-color: var(--docs-border-color, #3b4355);
	}

	h1[md],
	h2[md],
	table[md],
	table th[md],
	table td[md],
	span.frame > span[md] {
		border-color: var(--docs-border-color, #3b4355);
	}

	table tr[md]:nth-child(2n),
	.csv-data th[md] {
		background-color: var(--docs-background-color-soft, #252b3a);
	}

	.tip[md] code:not(.hljs) {
		color: var(--docs-foreground-color-light, #d9d9d9);
		background-color: var(--docs-background-color-mute, #303748);
	}

	code[md]:not(.hljs) {
		color: var(
			--docs-code-foreground,
			color-mix(in srgb, var(--docs-primary-color, #873bf4) 65%, #fff)
		);
	}
}

@media screen and (width <= 768px) {
	@include block(docs-markdown-reset) {
		font-size: 13px;

		& h1[#{$sign}] { font-size: 1.7em; }

		& h2[#{$sign}] { font-size: 1.35em; }

		& .header-anchor[#{$sign}],
		& .anchor[#{$sign}] {
			margin-left: -12px;
		}

		& table th[#{$sign}],
		& table td[#{$sign}] {
			padding: 7px 10px;
		}
	}
}

@media (prefers-reduced-motion: reduce) {
	@include block(docs-markdown-reset) {
		& .anchor[#{$sign}],
		& a[#{$sign}][href],
		& table tbody tr[#{$sign}],
		&>details>summary {
			transition: none;
		}
	}

	.header-anchor {
		transition: none;
	}
}
</style>
