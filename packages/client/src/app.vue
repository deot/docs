<template>
	<div class="docs-app" :class="{ 'docs-app--database': route.meta?.docsDatabase, 'docs-app--editor': isEditorShell }">
		<div class="docs-app__header">
			<ResourceSlot name="header" />
		</div>
		<div
			class="docs-layout"
			:class="{
				'docs-layout--database': route.meta?.docsDatabase,
				'docs-layout--editor': isEditorShell,
				'docs-layout--home': route.meta?.docsHome
			}"
		>
			<aside class="docs-layout__sidebar">
				<Scroller
					class="docs-layout__sidebar-scroller"
					:auto-resize="true"
					:native="false"
					:show-bar="true"
					height="100%"
					wrapper-style="overflow-x: hidden;"
				>
					<ResourceSlot name="sidebar" />
				</Scroller>
			</aside>
			<Scroller
				ref="mainScroller"
				class="docs-layout__main-scroller"
				:auto-resize="true"
				:native="false"
				:show-bar="true"
				height="100%"
				content-class="docs-layout__content"
				wrapper-style="overflow-x: hidden;"
			>
				<main class="docs-layout__main">
					<RouterView />
					<RouterView name="extra" />
				</main>
				<div class="docs-layout__footer"><ResourceSlot name="footer" /></div>
			</Scroller>
		</div>
	</div>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { Scroller } from '@deot/vc';
import type { ScrollerExposed } from '@deot/vc';
import { RouterView, useRoute } from 'vue-router';
import { ResourceSlot } from './components/layout';
import { isRendererEditorDemo } from './pages/renderer-editor-demos/catalog';

const route = useRoute();
const mainScroller = ref<ScrollerExposed>();
const isEditorShell = computed(() => (
	Boolean(route.meta?.docsEditor)
	|| (Boolean(route.meta?.docsEditorDemos) && isRendererEditorDemo(route.query.name))
));

// Vue Router 的 scrollBehavior 只能控制 window；正文位于 VcScroller 内，
// 因此路由内容变化时需要单独重置该滚动容器。
watch(
	[() => route.path, () => JSON.stringify(route.query)],
	async () => {
		await nextTick();
		mainScroller.value?.setScrollTop(0);
	}
);
</script>
<style lang="scss">
@use '../node_modules/@deot/docs-theme/src/variables';
@use './styles/bem' as *;

html,
body,
#app {
	height: 100%;
	margin: 0;
	overflow: hidden;
}

* {
	box-sizing: border-box;
}

body {
	font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif;
	font-size: 14px;
	color: varfix(foreground-color-light);
	background: varfix(background-color);
}

::view-transition-old(root),
::view-transition-new(root) {
	animation: none;
	mix-blend-mode: normal;
}

::view-transition-old(root) {
	z-index: 1;
}

::view-transition-new(root) {
	z-index: 2147483646;
}

a {
	color: inherit;
	text-decoration: none;
}

@include block(docs-app) {
	display: grid;
	grid-template-areas:
		"header"
		"body";
	grid-template-rows: 60px minmax(0, 1fr);
	width: 100%;
	height: 100%;
	overflow: hidden;

	@include modifier(database) {
		grid-template-areas: "body";
		grid-template-rows: minmax(0, 1fr);

		@include element(header) {
			display: none;
		}
	}

	@include modifier(editor) {
		grid-template-areas: "body";
		grid-template-rows: minmax(0, 1fr);

		@include element(header) { display: none; }
	}

	@include element(header) {
		grid-area: header;
	}
}

@include block(docs-layout) {
	position: relative;
	display: grid;
	grid-area: body;
	grid-template-areas: "sidebar main";
	grid-template-columns: 260px minmax(0, 1fr);
	min-width: 0;
	min-height: 0;
	overflow: hidden;

	&::after {
		position: absolute;
		top: -1px;
		left: 0;
		width: 100%;
		height: 1px;
		pointer-events: none;
		content: "";
		box-shadow: 0 2px 8px varfix(border-color-light);
	}

	&:not(:has(.docs-sidebar)) {
		grid-template-areas: "main";
		grid-template-columns: minmax(0, 1fr);

		@include element(sidebar) {
			display: none;
		}

	}

	@include modifier(database) {
		grid-template-areas: "main";
		grid-template-columns: minmax(0, 1fr);

		&::after {
			display: none;
		}

		@include element(sidebar) {
			display: none;
		}

		@include element(main) {
			padding: 0;
		}

		@include element(footer) {
			display: none;
		}
	}

	@include modifier(editor) {
		grid-template-areas: "main";
		grid-template-columns: minmax(0, 1fr);

		&::after { display: none; }

		@include element(sidebar) { display: none; }

		@include element(footer) { display: none; }

		@include element(main-scroller) { overflow: hidden; }

		@include element(content) {
			grid-template-areas: "main";
			grid-template-rows: minmax(0, 1fr);
			height: 100%;
			min-height: 0;
		}

		@include element(main) {
			height: 100%;
			min-height: 0;
			padding: 0;
			overflow: hidden;
		}
	}

	@include modifier(home) {
		@include element(main) {
			padding: 0;
		}
	}

	@include element(sidebar) {
		grid-area: sidebar;
		width: 100%;
		min-height: 0;
		overflow: hidden;
		background: varfix(background-color);
		border-right: 1px solid varfix(border-color);
	}

	@include element(sidebar-scroller) {
		width: 100%;
		height: 100%;
	}

	@include element(main-scroller) {
		grid-area: main;
		width: 100%;
		min-width: 0;
		min-height: 0;
	}

	@include element(content) {
		display: grid;
		grid-template-areas:
			"main"
			"footer";
		grid-template-rows: minmax(min-content, 1fr) auto;
		min-height: 100%;
		overflow-anchor: none;
	}

	@include element(main) {
		display: grid;
		grid-area: main;
		grid-template-columns: minmax(0, 1fr);
		min-width: 0;
		padding: 30px 40px 80px;
		align-content: start;

		&:has(.docs-home) {
			padding: 0;
		}

		> .docs-resource-slot[data-slot="content"][data-resource-type="markdown"] {
			min-height: 600px;
		}

		> .docs-resource-slot[data-slot="content"][data-resource-type="sfc"] {
			min-height: 120px;
		}
	}

	@include element(footer) {
		grid-area: footer;
		min-width: 0;
	}
}

@media screen and (width <= 768px) {
	@include block(docs-layout) {
		grid-template-columns: 220px minmax(0, 1fr);

		@include element(sidebar) {
			width: 100%;
		}

		@include element(main) {
			padding-right: 24px;
			padding-left: 24px;

			&:has(.docs-home) {
				padding: 0;
			}
		}

		@include modifier(home) {
			@include element(main) {
				padding: 0;
			}
		}

		&:not(:has(.docs-sidebar)) {
			grid-template-columns: minmax(0, 1fr);
		}
	}
}
</style>
