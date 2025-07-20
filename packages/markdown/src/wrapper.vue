<template>
	<div class="docs-markdown-reset" v-markdown="modelValue || value"></div>
</template>
<script setup>
import { vMarkdown } from './directive';

// 后续再做change
defineEmits(['update:modelValue', 'change']);
defineProps({
	modelValue: String,
	value: String
});
</script>
<style lang="scss">
@use 'highlight.js/styles/github.css';

code.hljs {
	padding: 10px;
	border-radius: 5px!important;
	background-color: #f9fafc;
	position: relative;
}

*,
*::before,
*::after {
	box-sizing: border-box
}

a {
	color: #333;
	text-decoration: none
}

ul,
li {
	list-style: none;
	padding: 0
}

h1 .header-anchor,
h2 .header-anchor,
h3 .header-anchor,
h4 .header-anchor,
h5 .header-anchor,
h6 .header-anchor {
	margin-left: -15px;
	margin-right: 5px;
	float: left;
	opacity: 0
}

h1:hover .header-anchor,
h2:hover .header-anchor,
h3:hover .header-anchor,
h4:hover .header-anchor,
h5:hover .header-anchor,
h6:hover .header-anchor {
	opacity: 1
}

$sign: md;

.docs-markdown-reset {
	font-family:
		-apple-system,
		BlinkMacSystemFont,
		Segoe UI,
		Helvetica,
		Arial,
		sans-serif,
		Apple Color Emoji,
		Segoe UI Emoji,
		Segoe UI Symbol
	;
	line-height: 1.5;
	font-size: 12px; // em基于此放大
	word-wrap: break-word;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
	color: #515a6e;
}

.docs-markdown-reset {
	ol[#{$sign}], ul[#{$sign}], li[#{$sign}] {
		list-style: unset;
	}
}

.docs-markdown-reset::before {
	display: table;
	content: "";
}

.docs-markdown-reset::after {
	display: table;
	clear: both;
	content: "";
}

.docs-markdown-reset>*[#{$sign}]:first-child {
	margin-top: 0 !important;
}

.docs-markdown-reset>*[#{$sign}]:last-child {
	margin-bottom: 0 !important;
}

.docs-markdown-reset a[#{$sign}]:not([href]) {
	color: inherit;
	text-decoration: none;
}

.docs-markdown-reset .absent[#{$sign}] {
	color: #cb2431;
}

.docs-markdown-reset .anchor[#{$sign}] {
	float: left;
	padding-right: 6px;
	margin-left: -20px;
	line-height: 1;
}

.docs-markdown-reset .anchor i[#{$sign}] {
	font-size: 18px;
}

.docs-markdown-reset .anchor[#{$sign}]:focus {
	outline: none;
}

.docs-markdown-reset p[#{$sign}],
.docs-markdown-reset blockquote[#{$sign}],
.docs-markdown-reset ul[#{$sign}],
.docs-markdown-reset ol[#{$sign}],
.docs-markdown-reset dl[#{$sign}],
.docs-markdown-reset table[#{$sign}],
.docs-markdown-reset pre[#{$sign}] {
	margin-top: 0;
	margin-bottom: 16px;
}

.docs-markdown-reset hr[#{$sign}] {
	height: 0.25em;
	padding: 0;
	margin: 24px 0;
	background-color: #e1e4e8;
	border: 0;
}

.docs-markdown-reset blockquote[#{$sign}] {
	padding: 0 1em;
	color: #6a737d;
	border-left: 0.25em solid #dfe2e5;
}

.docs-markdown-reset blockquote[#{$sign}]>:first-child {
	margin-top: 0;
}

.docs-markdown-reset blockquote[#{$sign}]>:last-child {
	margin-bottom: 0;
}

.docs-markdown-reset kbd[#{$sign}] {
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

.docs-markdown-reset h1[#{$sign}],
.docs-markdown-reset h2[#{$sign}],
.docs-markdown-reset h3[#{$sign}],
.docs-markdown-reset h4[#{$sign}],
.docs-markdown-reset h5[#{$sign}],
.docs-markdown-reset h6[#{$sign}] {
	margin-top: 24px;
	margin-bottom: 16px;
	font-weight: 600;
	line-height: 1.25;
}

.docs-markdown-reset h1 .octicon-link[#{$sign}],
.docs-markdown-reset h2 .octicon-link[#{$sign}],
.docs-markdown-reset h3 .octicon-link[#{$sign}],
.docs-markdown-reset h4 .octicon-link[#{$sign}],
.docs-markdown-reset h5 .octicon-link[#{$sign}],
.docs-markdown-reset h6 .octicon-link[#{$sign}] {
	color: #1b1f23;
	vertical-align: middle;
	visibility: hidden;
}

.docs-markdown-reset h1:hover .anchor[#{$sign}],
.docs-markdown-reset h2:hover .anchor[#{$sign}],
.docs-markdown-reset h3:hover .anchor[#{$sign}],
.docs-markdown-reset h4:hover .anchor[#{$sign}],
.docs-markdown-reset h5:hover .anchor[#{$sign}],
.docs-markdown-reset h6:hover .anchor[#{$sign}] {
	text-decoration: none;
}

.docs-markdown-reset h1:hover .anchor .octicon-link[#{$sign}],
.docs-markdown-reset h2:hover .anchor .octicon-link[#{$sign}],
.docs-markdown-reset h3:hover .anchor .octicon-link[#{$sign}],
.docs-markdown-reset h4:hover .anchor .octicon-link[#{$sign}],
.docs-markdown-reset h5:hover .anchor .octicon-link[#{$sign}],
.docs-markdown-reset h6:hover .anchor .octicon-link[#{$sign}] {
	visibility: visible;
}

.docs-markdown-reset h1 tt[#{$sign}],
.docs-markdown-reset h1 code[#{$sign}],
.docs-markdown-reset h2 tt[#{$sign}],
.docs-markdown-reset h2 code[#{$sign}],
.docs-markdown-reset h3 tt[#{$sign}],
.docs-markdown-reset h3 code[#{$sign}],
.docs-markdown-reset h4 tt[#{$sign}],
.docs-markdown-reset h4 code[#{$sign}],
.docs-markdown-reset h5 tt[#{$sign}],
.docs-markdown-reset h5 code[#{$sign}],
.docs-markdown-reset h6 tt[#{$sign}],
.docs-markdown-reset h6 code[#{$sign}]
{
	font-size: inherit;
}

.docs-markdown-reset h1[#{$sign}] {
	padding-bottom: 0.3em;
	font-size: 2em;
	border-bottom: 1px solid #eaecef;
}

.docs-markdown-reset h2[#{$sign}] {
	padding-bottom: 0.3em;
	font-size: 1.5em;
	border-bottom: 1px solid #eaecef;
}

.docs-markdown-reset h3[#{$sign}] {
	font-size: 1.25em;
}

.docs-markdown-reset h4[#{$sign}] {
	font-size: 1em;
}

.docs-markdown-reset h5[#{$sign}] {
	font-size: 0.875em;
}

.docs-markdown-reset h6[#{$sign}] {
	font-size: 0.85em;
	color: #6a737d;
}

.docs-markdown-reset ul[#{$sign}],
.docs-markdown-reset ol[#{$sign}] {
	padding-left: 2em;
}

.docs-markdown-reset ul.no-list[#{$sign}],
.docs-markdown-reset ol.no-list[#{$sign}] {
	padding: 0;
	list-style-type: none;
}

.docs-markdown-reset ul ul[#{$sign}],
.docs-markdown-reset ul ol[#{$sign}],
.docs-markdown-reset ol ol[#{$sign}],
.docs-markdown-reset ol ul[#{$sign}] {
	margin-top: 0;
	margin-bottom: 0;
}

.docs-markdown-reset li[#{$sign}] {
	word-wrap: break-all;
}

.docs-markdown-reset li>p[#{$sign}] {
	margin-top: 16px;
}

.docs-markdown-reset li+li[#{$sign}] {
	margin-top: 0.25em;
}

.docs-markdown-reset dl[#{$sign}] {
	padding: 0;
}

.docs-markdown-reset dl dt[#{$sign}] {
	padding: 0;
	margin-top: 16px;
	font-size: 1em;
	font-style: italic;
	font-weight: 600;
}

.docs-markdown-reset dl dd[#{$sign}] {
	padding: 0 16px;
	margin-bottom: 16px;
}

.docs-markdown-reset table[#{$sign}] {
	display: block;
	width: 100%;
	overflow: auto;
	border-collapse: collapse;
	border-spacing: 0;
}

.docs-markdown-reset table th[#{$sign}] {
	font-weight: 600;
}

.docs-markdown-reset table th[#{$sign}],
.docs-markdown-reset table td[#{$sign}] {
	padding: 6px 13px;
	border: 1px solid #dfe2e5;
}

.docs-markdown-reset table tr[#{$sign}] {
	background-color: #fff;
	border-top: 1px solid #c6cbd1;
}

.docs-markdown-reset table tr[#{$sign}]:nth-child(2n) {
	background-color: #f6f8fa;
}

.docs-markdown-reset table img[#{$sign}] {
	background-color: transparent;
}

.docs-markdown-reset img[#{$sign}] {
	max-width: 100%;
	background-color: #fff;
	box-sizing: content-box;
}

.docs-markdown-reset img[align=right][#{$sign}] {
	padding-left: 20px;
}

.docs-markdown-reset img[align=left][#{$sign}] {
	padding-right: 20px;
}

.docs-markdown-reset .emoji[#{$sign}] {
	max-width: none;
	vertical-align: text-top;
	background-color: transparent;
}

.docs-markdown-reset span.frame[#{$sign}] {
	display: block;
	overflow: hidden;
}

.docs-markdown-reset span.frame>span[#{$sign}] {
	display: block;
	float: left;
	width: auto;
	padding: 7px;
	margin: 13px 0 0;
	overflow: hidden;
	border: 1px solid #dfe2e5;
}

.docs-markdown-reset span.frame span img[#{$sign}] {
	display: block;
	float: left;
}

.docs-markdown-reset span.frame span span[#{$sign}] {
	display: block;
	padding: 5px 0 0;
	clear: both;
	color: #24292e;
}

.docs-markdown-reset span.align-center[#{$sign}] {
	display: block;
	overflow: hidden;
	clear: both;
}

.docs-markdown-reset span.align-center>span[#{$sign}] {
	display: block;
	margin: 13px auto 0;
	overflow: hidden;
	text-align: center;
}

.docs-markdown-reset span.align-center span img[#{$sign}] {
	margin: 0 auto;
	text-align: center;
}

.docs-markdown-reset span.align-right[#{$sign}] {
	display: block;
	overflow: hidden;
	clear: both;
}

.docs-markdown-reset span.align-right>span[#{$sign}] {
	display: block;
	margin: 13px 0 0;
	overflow: hidden;
	text-align: right;
}

.docs-markdown-reset span.align-right span img[#{$sign}] {
	margin: 0;
	text-align: right;
}

.docs-markdown-reset span.float-left[#{$sign}] {
	display: block;
	float: left;
	margin-right: 13px;
	overflow: hidden;
}

.docs-markdown-reset span.float-left span[#{$sign}] {
	margin: 13px 0 0;
}

.docs-markdown-reset span.float-right[#{$sign}] {
	display: block;
	float: right;
	margin-left: 13px;
	overflow: hidden;
}

.docs-markdown-reset span.float-right>span[#{$sign}] {
	display: block;
	margin: 13px auto 0;
	overflow: hidden;
	text-align: right;
}

.docs-markdown-reset .csv-data td[#{$sign}],
.docs-markdown-reset .csv-data th[#{$sign}] {
	padding: 5px;
	overflow: hidden;
	font-size: 12px;
	line-height: 1;
	text-align: left;
	white-space: nowrap;
}

.docs-markdown-reset .csv-data .blob-num[#{$sign}] {
	padding: 10px 8px 9px;
	text-align: right;
	background: #fff;
	border: 0;
}

.docs-markdown-reset .csv-data tr[#{$sign}] {
	border-top: 0;
}

.docs-markdown-reset .csv-data th[#{$sign}] {
	font-weight: 600;
	background: #f6f8fa;
	border-top: 0;
}

// 代码样式
.docs-markdown-reset code[#{$sign}],
.docs-markdown-reset tt[#{$sign}] {
	margin: 0;
	font-size: 85%; // 文字大小缩放
	border-radius: 3px; // 圆角
}

.docs-markdown-reset code br[#{$sign}],
.docs-markdown-reset tt br[#{$sign}] {
	display: none;
}

.docs-markdown-reset del code[#{$sign}] {
	text-decoration: inherit;
}

.docs-markdown-reset pre[#{$sign}] {
	word-wrap: normal;
}

.docs-markdown-reset .highlight[#{$sign}] {
	margin-bottom: 16px;
}

.docs-markdown-reset .highlight pre[#{$sign}] {
	margin-bottom: 0;
	word-break: normal;
}

.docs-markdown-reset .highlight pre[#{$sign}] {
	padding: 16px;
	overflow: auto;
	font-size: 85%;
	line-height: 1.45;
	background-color: #f6f8fa;
	border-radius: 3px;
}

.docs-markdown-reset pre tt[#{$sign}] {
	display: inline;
	max-width: auto;
	padding: 0;
	margin: 0;
	overflow: visible;
	line-height: inherit;
	word-wrap: normal;
	background-color: transparent;
	border: 0;
}

.docs-markdown-reset .TIP[#{$sign}] {
	padding: 8px 16px;
	margin: 20px 0;
	background-color: #f9f0ff;
	border-left: 5px solid #873bf4;
	border-radius: 4px;

	p {
		margin-bottom: 0;
	}
}

.docs-markdown-reset .WARNING[#{$sign}] {
	padding: 8px 16px;
	margin: 20px 0;
	background-color: #fff6f7;
	border-left: 5px solid #fe6c6f;
	border-radius: 4px;

	p {
		margin-bottom: 0;
	}
}


.docs-markdown-reset code[#{$sign}]:not(.hljs)  {
	padding: 0 4px;
	background-color: #f9fafc;
	border: 1px solid #eaeefb;
	border-radius: 2px;
}

.docs-markdown-reset .TIP[#{$sign}] {
	code:not(.hljs)  {
		color: #445368;
		background-color: #ffffffb3;
	}
}

.docs-markdown-reset p a[#{$sign}] {
	color: #2d8cf0;
}
</style>
