<template>
	<div class="docs-markdown-reset" v-markdown="modelValue || value"></div>
</template>
<script setup lang="ts">
import { vMarkdown } from './directive';

// 后续再做change
defineEmits<{
	'update:modelValue': [value: string];
	'change': [value: string];
}>();
defineProps<{
	modelValue?: string;
	value?: string;
}>();
</script>
<style lang="scss">
@use '@deot/style/src/mixins/bem' as *;

*,
*::before,
*::after {
	box-sizing: border-box;
}

a {
	color: #333;
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
	opacity: 0;
}

h1:hover .header-anchor,
h2:hover .header-anchor,
h3:hover .header-anchor,
h4:hover .header-anchor,
h5:hover .header-anchor,
h6:hover .header-anchor {
	opacity: 1;
}

$sign: md;

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
	font-size: 12px; // em基于此放大
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
	line-height: 1.5;
	color: #515a6e;
	overflow-wrap: break-word;
}

@include block(docs-markdown-code-preview) {
	margin-bottom: 16px;
}

@include block(docs-markdown-reset) {
	ol[#{$sign}], ul[#{$sign}], li[#{$sign}] {
		list-style: unset;
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
		color: #cb2431;
	}

	& .anchor[#{$sign}] {
		float: left;
		padding-right: 6px;
		margin-left: -20px;
		line-height: 1;
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
		margin-bottom: 16px;
	}

	& hr[#{$sign}] {
		height: 0.25em;
		padding: 0;
		margin: 24px 0;
		background-color: #e1e4e8;
		border: 0;
	}

	& blockquote[#{$sign}] {
		padding: 0 1em;
		color: #6a737d;
		border-left: 0.25em solid #dfe2e5;
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
		color: #444d56;
		vertical-align: middle;
		background-color: #fafbfc;
		border: solid 1px #c6cbd1;
		border-bottom-color: #959da5;
		border-radius: 3px;
		box-shadow: inset 0 -1px 0 #959da5;
	}

	& h1[#{$sign}],
	& h2[#{$sign}],
	& h3[#{$sign}],
	& h4[#{$sign}],
	& h5[#{$sign}],
	& h6[#{$sign}] {
		margin-top: 24px;
		margin-bottom: 16px;
		font-weight: 600;
		line-height: 1.25;
	}

	& h1 .octicon-link[#{$sign}],
	& h2 .octicon-link[#{$sign}],
	& h3 .octicon-link[#{$sign}],
	& h4 .octicon-link[#{$sign}],
	& h5 .octicon-link[#{$sign}],
	& h6 .octicon-link[#{$sign}] {
		color: #1b1f23;
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
		padding-bottom: 0.3em;
		font-size: 2em;
		border-bottom: 1px solid #eaecef;
	}

	& h2[#{$sign}] {
		padding-bottom: 0.3em;
		font-size: 1.5em;
		border-bottom: 1px solid #eaecef;
	}

	& h3[#{$sign}] {
		font-size: 1.25em;
	}

	& h4[#{$sign}] {
		font-size: 1em;
	}

	& h5[#{$sign}] {
		font-size: 0.875em;
	}

	& h6[#{$sign}] {
		font-size: 0.85em;
		color: #6a737d;
	}

	& ul[#{$sign}],
	& ol[#{$sign}] {
		padding-left: 2em;
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
		overflow-wrap: break-all;
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
		width: 100%;
		overflow: auto;
		border-collapse: collapse;
		border-spacing: 0;
	}

	& table th[#{$sign}] {
		font-weight: 600;
	}

	& table th[#{$sign}],
	& table td[#{$sign}] {
		padding: 6px 13px;
		border: 1px solid #dfe2e5;
	}

	& table tr[#{$sign}] {
		background-color: #fff;
		border-top: 1px solid #c6cbd1;
	}

	& table tr[#{$sign}]:nth-child(2n) {
		background-color: #f6f8fa;
	}

	& table img[#{$sign}] {
		background-color: transparent;
	}

	& img[#{$sign}] {
		max-width: 100%;
		background-color: #fff;
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
		border: 1px solid #dfe2e5;
	}

	& span.frame span img[#{$sign}] {
		display: block;
		float: left;
	}

	& span.frame span span[#{$sign}] {
		display: block;
		padding: 5px 0 0;
		clear: both;
		color: #24292e;
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
		background: #fff;
		border: 0;
	}

	& .csv-data tr[#{$sign}] {
		border-top: 0;
	}

	& .csv-data th[#{$sign}] {
		font-weight: 600;
		background: #f6f8fa;
		border-top: 0;
	}

	// 代码样式
	& code[#{$sign}],
	& tt[#{$sign}] {
		margin: 0;
		font-size: 85%; // 文字大小缩放
		border-radius: 3px; // 圆角
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
		padding: 16px;
		overflow: auto;
		font-size: 85%;
		line-height: 1.45;
		background-color: #f6f8fa;
		border-radius: 3px;
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

	& .TIP[#{$sign}] {
		padding: 8px 16px;
		margin: 20px 0;
		background-color: #f9f0ff;
		border-left: 5px solid #873bf4;
		border-radius: 4px;

		p {
			margin-bottom: 0;
		}
	}

	& .WARNING[#{$sign}] {
		padding: 8px 16px;
		margin: 20px 0;
		background-color: #fff6f7;
		border-left: 5px solid #fe6c6f;
		border-radius: 4px;

		p {
			margin-bottom: 0;
		}
	}

	& code[#{$sign}]:not(.hljs)  {
		padding: 0 4px;
		background-color: #f9fafc;
		border: 1px solid #eaeefb;
		border-radius: 2px;
	}

	& .TIP[#{$sign}] {
		code:not(.hljs)  {
			color: #445368;
			background-color: #ffffffb3;
		}
	}

	& p a[#{$sign}] {
		color: #2d8cf0;
	}
}
</style>
