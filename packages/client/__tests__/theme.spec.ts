// @vitest-environment jsdom

import 'fake-indexeddb/auto';
import { Settings, Theme, ThemeRuntime } from '../src/modules/settings';
import { createDocsConfig } from './fixtures/docs';
import type { DocsConfig } from '../src/types';

const createConfig = (namespace: string, theme?: DocsConfig['theme']): DocsConfig => (
	createDocsConfig({
		locales: { 'en-US': { label: 'English' } },
		namespace,
		theme
	})
);

const createMedia = (dark = false, reduced = false): Window['matchMedia'] => query => ({
	matches: query.includes('reduced-motion') ? reduced : dark,
	media: query,
	onchange: null,
	addListener: vi.fn(),
	removeListener: vi.fn(),
	addEventListener: vi.fn(),
	removeEventListener: vi.fn(),
	dispatchEvent: vi.fn(() => false)
});

describe('docs theme', () => {
	beforeEach(() => {
		document.body.removeAttribute('data-doc-theme');
		document.body.removeAttribute('data-vc-theme');
		document.documentElement.removeAttribute('data-doc-theme');
		document.documentElement.removeAttribute('data-vc-theme');
		document.documentElement.style.removeProperty('color-scheme');
		window.matchMedia = createMedia();
	});

	it('persists generic settings by namespace', async () => {
		await Settings.set('theme-a', 'theme', 'dark');
		await Settings.set('theme-b', 'theme', 'light');
		expect(await Settings.get('theme-a', 'theme')).toBe('dark');
		expect(await Settings.get('theme-b', 'theme')).toBe('light');
		await Settings.remove('theme-a', 'theme');
		await Settings.remove('theme-b', 'theme');
	});

	it('uses the saved theme before HTML, config and system preferences', async () => {
		const namespace = 'theme-precedence';
		await Settings.set(namespace, 'theme', 'dark');
		document.body.setAttribute('data-doc-theme', 'light');
		const stop = ThemeRuntime.start(createConfig(namespace, { default: 'light' }));
		await vi.waitFor(() => expect(Theme.ready.value).toBe(true));
		expect(Theme.current.value).toBe('dark');
		expect(document.body.getAttribute('data-doc-theme')).toBe('dark');
		expect(document.body.getAttribute('data-vc-theme')).toBe('dark');
		expect(document.documentElement.getAttribute('data-vc-theme')).toBe('dark');
		stop();
		await Settings.remove(namespace, 'theme');
	});

	it('does not control body attributes when disabled', () => {
		document.body.setAttribute('data-doc-theme', 'dark');
		const stop = ThemeRuntime.start(createConfig('theme-disabled', false));
		expect(Theme.enabled.value).toBe(false);
		expect(document.body.getAttribute('data-doc-theme')).toBe('dark');
		expect(document.body.hasAttribute('data-vc-theme')).toBe(false);
		stop();
	});

	it('toggles both attributes and persists the explicit selection', async () => {
		const namespace = 'theme-toggle';
		const stop = ThemeRuntime.start(createConfig(namespace, { default: 'light' }));
		await vi.waitFor(() => expect(Theme.ready.value).toBe(true));
		await Theme.toggle();
		expect(Theme.current.value).toBe('dark');
		expect(document.body.getAttribute('data-vc-theme')).toBe('dark');
		expect(await Settings.get(namespace, 'theme')).toBe('dark');
		stop();
		await Settings.remove(namespace, 'theme');
	});

	it('rejects changes after the runtime session is stopped', async () => {
		const namespace = 'theme-stopped';
		const stop = ThemeRuntime.start(createConfig(namespace, { default: 'light' }));
		await vi.waitFor(() => expect(Theme.ready.value).toBe(true));
		stop();

		expect(Theme.enabled.value).toBe(false);
		await Theme.set('dark');
		expect(Theme.current.value).toBe('light');
		expect(await Settings.get(namespace, 'theme')).toBeNull();
	});

	it('follows the system theme until the user makes an explicit selection', async () => {
		const namespace = 'theme-system';
		let systemListener: ((event: MediaQueryListEvent) => void) | undefined;
		const removeEventListener = vi.fn();
		window.matchMedia = query => ({
			matches: query.includes('prefers-color-scheme'),
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
				if (type === 'change' && query.includes('prefers-color-scheme') && typeof listener === 'function') {
					systemListener = listener as (event: MediaQueryListEvent) => void;
				}
			},
			removeEventListener,
			dispatchEvent: vi.fn(() => false)
		});

		const stop = ThemeRuntime.start(createConfig(namespace, true));
		await vi.waitFor(() => expect(Theme.ready.value).toBe(true));
		expect(Theme.current.value).toBe('dark');
		systemListener?.({ matches: false } as MediaQueryListEvent);
		expect(Theme.current.value).toBe('light');

		await Theme.set('dark');
		expect(removeEventListener).toHaveBeenCalled();
		stop();
		await Settings.remove(namespace, 'theme');
	});

	it('uses a circular view transition when the browser supports it', async () => {
		const namespace = 'theme-transition';
		const origin = document.createElement('button');
		vi.spyOn(origin, 'getBoundingClientRect').mockReturnValue({
			bottom: 40,
			height: 20,
			left: 10,
			right: 50,
			top: 20,
			width: 40,
			x: 10,
			y: 20,
			toJSON: () => ({})
		});
		const animate = vi.fn().mockReturnValue({});
		Object.defineProperty(document.documentElement, 'animate', {
			configurable: true,
			value: animate
		});
		const startViewTransition = vi.fn((callback: () => void) => {
			const update = Promise.resolve(callback());
			return {
				finished: update,
				ready: update
			};
		});
		Object.defineProperty(document, 'startViewTransition', {
			configurable: true,
			value: startViewTransition
		});

		const stop = ThemeRuntime.start(createConfig(namespace, { default: 'light' }));
		await vi.waitFor(() => expect(Theme.ready.value).toBe(true));
		await Theme.set('dark', origin);
		expect(startViewTransition).toHaveBeenCalledOnce();
		expect(animate).toHaveBeenCalledWith(
			expect.objectContaining({ clipPath: expect.any(Array) }),
			expect.objectContaining({ pseudoElement: '::view-transition-new(root)' })
		);

		stop();
		await Settings.remove(namespace, 'theme');
		Reflect.deleteProperty(document, 'startViewTransition');
		Reflect.deleteProperty(document.documentElement, 'animate');
	});

	it('uses the toggler center for the first transition', async () => {
		const namespace = 'theme-transition-pointer';
		const origin = document.createElement('button');
		vi.spyOn(origin, 'getBoundingClientRect').mockReturnValue({
			bottom: 40,
			height: 20,
			left: 860,
			right: 900,
			top: 20,
			width: 40,
			x: 860,
			y: 20,
			toJSON: () => ({})
		});
		const animate = vi.fn().mockReturnValue({});
		Object.defineProperty(document.documentElement, 'animate', {
			configurable: true,
			value: animate
		});
		Object.defineProperty(document, 'startViewTransition', {
			configurable: true,
			value: (callback: () => void) => {
				const update = Promise.resolve(callback());
				return { finished: update, ready: update };
			}
		});

		const stop = ThemeRuntime.start(createConfig(namespace, { default: 'light' }));
		await vi.waitFor(() => expect(Theme.ready.value).toBe(true));
		await Theme.set('dark', origin);

		const [keyframes, options] = animate.mock.calls[0];
		const ratioX = 100 * 880 / window.innerWidth;
		const ratioY = 100 * 30 / window.innerHeight;
		expect(keyframes.clipPath[0]).toBe(`circle(0% at ${ratioX}% ${ratioY}%)`);
		expect(options).toEqual(expect.objectContaining({
			pseudoElement: '::view-transition-new(root)'
		}));
		stop();
		await Settings.remove(namespace, 'theme');
		Reflect.deleteProperty(document, 'startViewTransition');
		Reflect.deleteProperty(document.documentElement, 'animate');
	});

	it('expands the new theme from the button in both directions', async () => {
		const namespace = 'theme-transition-directions';
		const origin = document.createElement('button');
		vi.spyOn(origin, 'getBoundingClientRect').mockReturnValue({
			bottom: 40,
			height: 20,
			left: 880,
			right: 920,
			top: 20,
			width: 40,
			x: 880,
			y: 20,
			toJSON: () => ({})
		});
		const animate = vi.fn().mockReturnValue({});
		Object.defineProperty(document.documentElement, 'animate', {
			configurable: true,
			value: animate
		});
		Object.defineProperty(document, 'startViewTransition', {
			configurable: true,
			value: (callback: () => void) => {
				const update = Promise.resolve(callback());
				return { finished: update, ready: update };
			}
		});

		const stop = ThemeRuntime.start(createConfig(namespace, { default: 'light' }));
		await vi.waitFor(() => expect(Theme.ready.value).toBe(true));
		await Theme.set('dark', origin);
		await Theme.set('light', origin);

		expect(animate).toHaveBeenCalledTimes(2);
		for (const [keyframes, options] of animate.mock.calls) {
			expect(keyframes.clipPath[0]).toMatch(/^circle\(0% at /u);
			expect(options.pseudoElement).toBe('::view-transition-new(root)');
		}
		stop();
		await Settings.remove(namespace, 'theme');
		Reflect.deleteProperty(document, 'startViewTransition');
		Reflect.deleteProperty(document.documentElement, 'animate');
	});

	it('does not animate from the viewport center without a visible trigger', async () => {
		const namespace = 'theme-transition-without-origin';
		const startViewTransition = vi.fn();
		Object.defineProperty(document, 'startViewTransition', {
			configurable: true,
			value: startViewTransition
		});

		const stop = ThemeRuntime.start(createConfig(namespace, { default: 'light' }));
		await vi.waitFor(() => expect(Theme.ready.value).toBe(true));
		await Theme.set('dark');

		expect(startViewTransition).not.toHaveBeenCalled();
		expect(Theme.current.value).toBe('dark');
		stop();
		await Settings.remove(namespace, 'theme');
		Reflect.deleteProperty(document, 'startViewTransition');
	});

	it('uses the mounted theme toggler when the caller origin is unavailable', async () => {
		const namespace = 'theme-transition-mounted-origin';
		const toggler = document.createElement('button');
		toggler.className = 'theme-toggler';
		document.body.appendChild(toggler);
		vi.spyOn(toggler, 'getBoundingClientRect').mockReturnValue({
			bottom: 50,
			height: 20,
			left: 100,
			right: 140,
			top: 30,
			width: 40,
			x: 100,
			y: 30,
			toJSON: () => ({})
		});
		const animate = vi.fn().mockReturnValue({});
		Object.defineProperty(document.documentElement, 'animate', {
			configurable: true,
			value: animate
		});
		Object.defineProperty(document, 'startViewTransition', {
			configurable: true,
			value: (callback: () => void) => {
				const update = Promise.resolve(callback());
				return { finished: update, ready: update };
			}
		});

		const stop = ThemeRuntime.start(createConfig(namespace, { default: 'light' }));
		await vi.waitFor(() => expect(Theme.ready.value).toBe(true));
		await Theme.set('dark');

		const [keyframes] = animate.mock.calls[0];
		const ratioX = 100 * 120 / window.innerWidth;
		const ratioY = 100 * 40 / window.innerHeight;
		expect(keyframes.clipPath[0]).toBe(`circle(0% at ${ratioX}% ${ratioY}%)`);
		stop();
		toggler.remove();
		await Settings.remove(namespace, 'theme');
		Reflect.deleteProperty(document, 'startViewTransition');
		Reflect.deleteProperty(document.documentElement, 'animate');
	});

	it('does not let a delayed restore override a new user selection', async () => {
		const namespace = 'theme-restore-race';
		let resolveStored!: (value: unknown) => void;
		const stored = new Promise<unknown>((resolve) => {
			resolveStored = resolve;
		});
		const get = vi.spyOn(Settings, 'get').mockReturnValueOnce(stored);
		const stop = ThemeRuntime.start(createConfig(namespace, { default: 'light' }));
		await Theme.set('dark');
		resolveStored('light');
		await vi.waitFor(() => expect(Theme.ready.value).toBe(true));
		expect(Theme.current.value).toBe('dark');

		get.mockRestore();
		stop();
		await Settings.remove(namespace, 'theme');
	});

	it('serializes rapid toggles and persists the final selection', async () => {
		const namespace = 'theme-rapid-toggle';
		const origin = document.createElement('button');
		vi.spyOn(origin, 'getBoundingClientRect').mockReturnValue({
			bottom: 40,
			height: 20,
			left: 880,
			right: 920,
			top: 20,
			width: 40,
			x: 880,
			y: 20,
			toJSON: () => ({})
		});
		let releaseFirst!: () => void;
		const firstFinished = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		let transitionCount = 0;
		Object.defineProperty(document.documentElement, 'animate', {
			configurable: true,
			value: vi.fn()
		});
		Object.defineProperty(document, 'startViewTransition', {
			configurable: true,
			value: (callback: () => void) => {
				transitionCount++;
				const update = Promise.resolve(callback());
				return {
					finished: transitionCount === 1 ? firstFinished : update,
					ready: update
				};
			}
		});

		const stop = ThemeRuntime.start(createConfig(namespace, { default: 'light' }));
		await vi.waitFor(() => expect(Theme.ready.value).toBe(true));
		const first = Theme.toggle(origin);
		await vi.waitFor(() => expect(Theme.current.value).toBe('dark'));
		const second = Theme.toggle(origin);
		releaseFirst();
		await Promise.all([first, second]);

		expect(transitionCount).toBe(2);
		expect(Theme.current.value).toBe('light');
		expect(await Settings.get(namespace, 'theme')).toBe('light');
		stop();
		await Settings.remove(namespace, 'theme');
		Reflect.deleteProperty(document, 'startViewTransition');
		Reflect.deleteProperty(document.documentElement, 'animate');
	});

	it('does not persist an old transition into a restarted namespace', async () => {
		const oldNamespace = 'theme-old-session';
		const newNamespace = 'theme-new-session';
		const origin = document.createElement('button');
		vi.spyOn(origin, 'getBoundingClientRect').mockReturnValue({
			bottom: 40,
			height: 20,
			left: 880,
			right: 920,
			top: 20,
			width: 40,
			x: 880,
			y: 20,
			toJSON: () => ({})
		});
		let releaseTransition!: () => void;
		const finished = new Promise<void>((resolve) => {
			releaseTransition = resolve;
		});
		Object.defineProperty(document.documentElement, 'animate', {
			configurable: true,
			value: vi.fn()
		});
		Object.defineProperty(document, 'startViewTransition', {
			configurable: true,
			value: (callback: () => void) => ({
				finished,
				ready: Promise.resolve(callback())
			})
		});

		const stopOld = ThemeRuntime.start(createConfig(oldNamespace, { default: 'light' }));
		await vi.waitFor(() => expect(Theme.ready.value).toBe(true));
		const oldSelection = Theme.set('dark', origin);
		await vi.waitFor(() => expect(Theme.current.value).toBe('dark'));
		const stopNew = ThemeRuntime.start(createConfig(newNamespace, { default: 'light' }));
		releaseTransition();
		await oldSelection;
		await vi.waitFor(() => expect(Theme.ready.value).toBe(true));

		expect(Theme.current.value).toBe('light');
		expect(await Settings.get(oldNamespace, 'theme')).toBeNull();
		expect(await Settings.get(newNamespace, 'theme')).toBeNull();
		stopOld();
		stopNew();
		Reflect.deleteProperty(document, 'startViewTransition');
		Reflect.deleteProperty(document.documentElement, 'animate');
	});
});
