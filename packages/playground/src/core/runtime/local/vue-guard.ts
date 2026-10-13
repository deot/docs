import * as Vue from 'vue';
import type { Component } from 'vue';

export interface VueGuardCapture {
	/** files 里 `createApp(Root).mount(...)` 捕获到的根组件。 */
	mountedComponent: unknown;
	/** `app.component()` 注册的局部组件，挂到预览根上。 */
	components: Record<string, unknown>;
	/** `app.provide()` 写入的依赖，挂到预览根上。 */
	provides: Record<PropertyKey, unknown>;
}

/**
 * 给 files 注入选定的 Vue，但 `createApp().mount` 不会卸掉页面。
 * 防护按本次 link 创建，多个 Playground 互不覆盖。
 * @param capture 本次链接收集到的根组件、局部组件和 provide。
 * @param vue 当前预览选定的 Vue。
 * @returns 带防护的 Vue 模块。
 */
export const createGuardedVue = (capture: VueGuardCapture, vue = Vue) => {
	const createApp = (rootComponent?: unknown, rootProps?: unknown) => {
		const fakeApp = {
			_component: rootComponent,
			_props: rootProps,
			config: {
				errorHandler: null as unknown,
				warnHandler: null as unknown,
				globalProperties: {} as Record<string, unknown>
			},
			_context: {
				provides: Object.create(null) as Record<PropertyKey, unknown>,
				components: Object.create(null) as Record<string, unknown>,
				directives: Object.create(null) as Record<string, unknown>,
				mixins: [] as unknown[]
			},
			use() { return fakeApp; },
			mixin(mixin: unknown) {
				fakeApp._context.mixins.push(mixin);
				return fakeApp;
			},
			component(name: string, component?: unknown) {
				if (component) {
					fakeApp._context.components[name] = component;
					return fakeApp;
				}
				return fakeApp._context.components[name];
			},
			directive() { return fakeApp; },
			provide(key: PropertyKey, value: unknown) {
				fakeApp._context.provides[key] = value;
				return fakeApp;
			},
			mount() {
				capture.components = { ...fakeApp._context.components };
				capture.provides = { ...fakeApp._context.provides };
				capture.mountedComponent = vue.defineComponent({
					name: 'PlaygroundCapturedApp',
					components: fakeApp._context.components as Record<string, Component>,
					setup() {
						Reflect.ownKeys(fakeApp._context.provides).forEach((key) => {
							vue.provide(key, fakeApp._context.provides[key]);
						});
						return () => vue.h(rootComponent as never, (rootProps || null) as never);
					}
				});
				return capture.mountedComponent;
			},
			unmount() {},
			onUnmount() { return fakeApp; }
		};
		return fakeApp;
	};

	return new Proxy(vue, {
		get(target, prop, receiver) {
			if (prop === 'createApp' || prop === 'createSSRApp') return createApp;
			if (prop === 'default') return receiver;
			return Reflect.get(target, prop, receiver);
		}
	});
};
