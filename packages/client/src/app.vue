<template>
	<div
		class="docs-app"
		:class="{
			'docs-app--database': isUtilityShell,
			'docs-app--editor': isEditorShell,
			'docs-app--mobile-sidebar-open': mobileSidebarOpen
		}"
		@keydown.esc="closeMobileSidebar"
	>
		<div class="docs-app__header">
			<button
				type="button"
				class="docs-app__sidebar-toggle"
				:class="{ 'is-open': mobileSidebarOpen }"
				:aria-label="t(mobileSidebarOpen ? 'client.header.closeSidebar' : 'client.header.openSidebar')"
				:aria-expanded="mobileSidebarOpen"
				aria-controls="docs-mobile-sidebar"
				@click="toggleMobileSidebar"
			>
				<ClientIcon :name="mobileSidebarOpen ? 'close' : 'menu'" />
			</button>
			<ResourceSlot name="header" />
		</div>
		<div
			class="docs-layout"
			:class="{
				'docs-layout--database': isUtilityShell,
				'docs-layout--editor': isEditorShell,
				'docs-layout--home': route.meta?.docsHome
			}"
		>
			<aside
				id="docs-mobile-sidebar"
				class="docs-layout__sidebar"
				@click="handleSidebarNavigation"
			>
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
			<button
				type="button"
				class="docs-layout__sidebar-mask"
				:aria-label="t('client.header.closeSidebar')"
				@click="closeMobileSidebar"
			></button>
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
import { useLocale } from '@deot/docs-locale';
import { ResourceSlot } from './components/layout';
import ClientIcon from './components/icon';
import { isRendererEditorDemo } from './pages/renderer-editor-demos/catalog';

const route = useRoute();
const { t } = useLocale();
const mainScroller = ref<ScrollerExposed>();
const mobileSidebarOpen = ref(false);
const isUtilityShell = computed(() => (
	Boolean(route.meta?.docsDatabase || route.meta?.docsPlaygroundResource)
));
const isEditorShell = computed(() => (
	Boolean(route.meta?.docsEditor)
	|| (Boolean(route.meta?.docsEditorDemos) && isRendererEditorDemo(route.query.name))
));
const closeMobileSidebar = () => {
	mobileSidebarOpen.value = false;
};
const toggleMobileSidebar = () => {
	mobileSidebarOpen.value = !mobileSidebarOpen.value;
};
const handleSidebarNavigation = (event: MouseEvent) => {
	if ((event.target as Element | null)?.closest('a')) closeMobileSidebar();
};

// Vue Router 的 scrollBehavior 只能控制 window；正文位于 VcScroller 内，
// 因此路由内容变化时需要单独重置该滚动容器。
watch(
	[() => route.path, () => JSON.stringify(route.query)],
	async () => {
		closeMobileSidebar();
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
		position: relative;
		grid-area: header;
	}

	@include element(sidebar-toggle) {
		display: none;
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

	@include element(sidebar-mask) {
		display: none;
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
	html,
	body,
	#app {
		height: 100dvh;
	}

	@include block(docs-app) {
		height: 100dvh;

		&:not(.docs-app--database, .docs-app--editor):has(.docs-layout__sidebar .docs-sidebar) {
			@include element(sidebar-toggle) {
				position: absolute;
				top: 12px;
				left: 12px;
				z-index: 2;
				display: inline-flex;
				width: 36px;
				height: 36px;
				padding: 0;
				color: varfix(foreground-color-light);
				cursor: pointer;
				background: transparent;
				border: 0;
				border-radius: 8px;
				align-items: center;
				justify-content: center;

				&:hover,
				&:focus-visible {
					color: varfix(primary-color);
					background: varfix(primary-color-light);
					outline: none;
				}
			}
		}
	}

	@include block(docs-layout) {
		grid-template-areas: "main";
		grid-template-columns: minmax(0, 1fr);

		@include element(sidebar) {
			position: absolute;
			z-index: 20;
			inset: 0 auto 0 0;
			width: min(84vw, 320px);
			border-right: 0;
			visibility: hidden;
			transform: translateX(-100%);
			box-shadow: 8px 0 24px varfix(shadow-color);
			transition: transform 0.24s ease, visibility 0.24s step-end;
		}

		@include element(sidebar-mask) {
			position: absolute;
			z-index: 10;
			inset: 0;
			display: block;
			padding: 0;
			cursor: pointer;
			background: varfix(mask-color);
			border: 0;
			opacity: 0;
			visibility: hidden;
			transition: opacity 0.24s ease, visibility 0.24s step-end;
		}

		@include element(main) {
			padding: 24px 20px 56px;

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

	.docs-app--mobile-sidebar-open {
		.docs-layout__sidebar:has(.docs-sidebar) {
			visibility: visible;
			transform: translateX(0);
			transition: transform 0.24s ease, visibility 0s;
		}

		.docs-layout__sidebar-mask {
			opacity: 1;
			visibility: visible;
			transition: opacity 0.24s ease, visibility 0s;
		}
	}
}

@media screen and (width <= 480px) {
	@include block(docs-layout) {
		@include element(main) {
			padding: 20px 16px 48px;
		}
	}
}

@media (prefers-reduced-motion: reduce) {
	.docs-layout__sidebar,
	.docs-layout__sidebar-mask {
		transition: none !important;
	}
}
</style>
