<template>
	<div class="docs-renderer-hero-panel">
		<div class="docs-renderer-hero-panel__window">
			<div class="docs-renderer-hero-panel__toolbar">
				<span class="docs-renderer-hero-panel__dots" aria-hidden="true"><i /><i /><i /></span>
				<span>{{ visual.title }}</span>
			</div>
			<div v-if="visual.type === 'markdown'" class="docs-renderer-hero-panel__workspace">
				<nav v-if="headings.length" class="docs-renderer-hero-panel__nav" :aria-label="visual.title">
					<span>{{ visual.title }}</span>
					<button v-for="(heading, index) in headings" :key="index" type="button" @click="scrollToHeading(index)">{{ heading }}</button>
				</nav>
				<Scroller
					ref="documentScroller"
					class="docs-renderer-hero-panel__document-scroller"
					height="100%"
					:native="false"
					:auto-resize="true"
					:show-bar="true"
				>
					<div ref="body" class="docs-renderer-hero-panel__document" tabindex="0" v-html="html" />
				</Scroller>
			</div>
			<Scroller
				v-else
				class="docs-renderer-hero-panel__code-scroller"
				height="calc(100% - 43px)"
				:native="false"
				:auto-resize="true"
				:show-bar="true"
			>
				<pre class="docs-renderer-hero-panel__code" tabindex="0"><code :class="`language-${visual.language}`" v-html="code" /></pre>
			</Scroller>
		</div>
		<span class="docs-renderer-hero-panel__tag">
			{{ visual.type === 'code' ? visual.language || 'Code' : 'Markdown' }}
			<i v-if="visual.type === 'code'" aria-hidden="true" />
		</span>
	</div>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { Scroller } from '@deot/vc';
import type { ScrollerExposed } from '@deot/vc';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import type { RendererHeroVisual } from './visual';

const props = defineProps<{ visual: RendererHeroVisual }>();
const body = ref<HTMLElement>();
const documentScroller = ref<ScrollerExposed & ComponentPublicInstance>();
const md = new MarkdownIt({ html: false, breaks: true });
Object.entries({ javascript, typescript, json, xml, css, bash }).forEach(([name, language]) => hljs.registerLanguage(name, language));
const tokens = computed(() => md.parse(props.visual.content, {}));
const headings = computed(() => tokens.value.flatMap((token, index) => (
	token.type === 'heading_open' && token.tag === 'h2' ? [tokens.value[index + 1].content] : []
)));
const html = computed(() => md.renderer.render(tokens.value, md.options, {}));
const code = computed(() => {
	const { content, language } = props.visual;
	return language && hljs.getLanguage(language)
		? hljs.highlight(content, { language, ignoreIllegals: true }).value
		: md.utils.escapeHtml(content);
});
const scrollToHeading = (index: number) => {
	const heading = body.value?.querySelectorAll('h2')[index];
	const wrapper = documentScroller.value?.$el as HTMLElement | undefined;
	if (!wrapper || !heading) return;
	documentScroller.value?.setScrollTop(wrapper.scrollTop + heading.getBoundingClientRect().top - wrapper.getBoundingClientRect().top - 22);
};
</script>
<style lang="scss">
@use '../../../../node_modules/@deot/docs-theme/src/functions' as *;

.docs-renderer-hero-panel {
	position: relative;
	width: 100%;
	height: 360px;
	padding: 18px 18px 24px 8px;
	text-align: left;
	box-sizing: border-box;

	&__window {
		height: 100%;
		overflow: hidden;
		background: var(--docs-renderer-paper);
		border: 1px solid var(--docs-renderer-paper-rule);
		border-radius: 16px;
		box-shadow: 0 15px 45px #47517606;
	}

	&__toolbar {
		display: flex;
		height: 43px;
		gap: 16px;
		padding-inline: 18px;
		font-size: 11px;
		color: var(--docs-renderer-muted);
		border-bottom: 1px solid var(--docs-renderer-paper-rule);
		align-items: center;
		box-sizing: border-box;
	}

	&__dots {
		display: flex;
		gap: 5px;

		i {
			width: 5px;
			height: 5px;
			background: color-mix(in srgb, var(--docs-renderer-accent) 22%, var(--docs-renderer-paper));
			border-radius: 50%;
		}
	}

	&__workspace {
		display: flex;
		height: calc(100% - 43px);
	}

	&__nav {
		display: flex;
		width: 132px;
		padding: 25px 15px;
		overflow: auto;
		background: color-mix(in srgb, var(--docs-renderer-accent) 2%, var(--docs-renderer-paper));
		border-right: 1px solid var(--docs-renderer-paper-rule);
		box-sizing: border-box;
		flex: 0 0 auto;
		flex-direction: column;
		gap: 14px;

		span, button {
			font: inherit;
			font-size: 10px;
			line-height: 1.6;
			overflow-wrap: anywhere;
		}

		span {
			color: var(--docs-renderer-accent);
		}

		button {
			padding: 0;
			color: var(--docs-renderer-muted);
			text-align: left;
			cursor: pointer;
			background: none;
			border: 0;
		}
	}

	&__document {
		min-width: 0;
		padding: 22px 27px;
		font-size: 11px;
		line-height: 1.85;
		color: var(--docs-renderer-muted);
		overflow-wrap: anywhere;

		h1 {
			margin: 0 0 10px;
			font-size: 22px;
			font-weight: 550;
			line-height: 1.45;
			color: var(--docs-renderer-ink);
		}

		h2, h3, h4, h5, h6 {
			margin: 16px 0 6px;
			font-size: 12px;
			font-weight: 550;
			color: var(--docs-renderer-ink);
		}

		p {
			margin: 0 0 8px;
		}

		img {
			max-width: 100%;
		}

		pre {
			overflow: auto;
		}

		a {
			color: var(--docs-renderer-accent);
		}
	}

	&__document-scroller {
		min-width: 0;
		flex: 1;
	}

	&__code {
		min-width: max-content;
		padding: 24px;
		margin: 0;
		font-family: SFMono-Regular, Consolas, monospace;
		font-size: 11px;
		line-height: 25px;
		color: var(--docs-renderer-ink);
		background: color-mix(in srgb, var(--docs-renderer-accent) 2%, var(--docs-renderer-paper));
		box-sizing: border-box;

		.hljs-keyword, .hljs-tag, .hljs-selector-tag, .hljs-literal {
			color: var(--docs-renderer-accent);
		}

		.hljs-string, .hljs-attr, .hljs-number, .hljs-title {
			color: color-mix(in srgb, var(--docs-renderer-accent) 65%, var(--docs-renderer-ink));
		}

		.hljs-comment {
			color: var(--docs-renderer-muted);
		}
	}

	&__tag {
		position: absolute;
		right: 0;
		bottom: 6px;
		display: flex;
		gap: 9px;
		padding: 9px 14px;
		font-size: 10px;
		line-height: 1.5;
		color: var(--docs-renderer-accent);
		background: var(--docs-renderer-paper);
		border: 1px solid var(--docs-renderer-paper-rule);
		border-radius: 9px;
		align-items: center;

		i {
			width: 1px;
			height: 12px;
			background: currentcolor;
		}
	}

	@container (width <= 760px) {
		height: 330px;
		padding-left: 0;

		&__nav {
			display: none;
		}

		&__document, &__code {
			padding: 20px;
		}

		&__document h1 {
			font-size: 20px;
		}
	}
}

.docs-renderer-hero.has-motion .docs-renderer-hero-panel {
	&__window {
		animation: docs-renderer-panel-float 6s ease-in-out infinite;
	}

	&__tag i {
		animation: docs-renderer-cursor 1.5s step-end infinite;
	}
}

@keyframes docs-renderer-panel-float {
	50% {
		transform: translateY(-7px);
	}
}

@keyframes docs-renderer-cursor {
	50% {
		opacity: 0;
	}
}
</style>
