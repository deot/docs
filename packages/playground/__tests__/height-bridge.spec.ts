// @vitest-environment jsdom
import { defineComponent, h, nextTick, shallowRef } from 'vue';
import { mount } from '@vue/test-utils';
import { usePreviewHeightBridge } from '../src/core/runtime/height-bridge';

describe('preview height host', () => {
	const setup = (maxHeight?: () => number) => {
		const container = document.createElement('div');
		const iframe = document.createElement('iframe');
		container.appendChild(iframe);
		document.body.appendChild(container);
		const source = iframe.contentWindow!;
		const reply = vi.spyOn(source, 'postMessage').mockImplementation(() => {});
		const sandbox = shallowRef({ container });
		const wrapper = mount(defineComponent({
			setup() {
				const height = usePreviewHeightBridge(sandbox, maxHeight);
				return () => h('div', height.value);
			}
		}));
		const send = async (operation: string, id = 1, height = 560, session = 'one', from: Window = source) => {
			window.dispatchEvent(new MessageEvent('message', {
				source: from,
				data: { action: 'docs:height', operation, id, height, session }
			}));
			await nextTick();
		};
		const dispose = () => { wrapper.unmount(); container.remove(); };
		return { wrapper, reply, send, dispose, sandbox };
	};

	it('takes the maximum request and isolates manual release from other runs', async () => {
		const host = setup();
		await host.send('start');
		await host.send('enable', 1, 560);
		await host.send('enable', 2, 720);
		expect(host.wrapper.text()).toBe('720');
		await host.send('release', 2);
		expect(host.wrapper.text()).toBe('560');
		await host.send('release', 1);
		expect(host.wrapper.text()).toBe('0');
		expect(host.reply).toHaveBeenCalledWith(expect.objectContaining({ accepted: true, id: 1 }), '*');
		host.dispose();
	});

	it('rejects other sources, old sessions, and malformed heights', async () => {
		const host = setup();
		await host.send('start');
		await host.send('enable', 1, 560, 'one', window);
		await host.send('enable', 1, NaN);
		expect(host.wrapper.text()).toBe('0');
		await host.send('enable');
		await host.send('start', 1, 0, 'two');
		await host.send('enable', 1, 720, 'one');
		expect(host.wrapper.text()).toBe('0');
		await host.send('enable', 2, 240, 'two');
		await host.send('stop', 1, 0, 'one');
		expect(host.wrapper.text()).toBe('240');
		host.dispose();
	});

	it('rejects heights beyond standalone available space', async () => {
		const host = setup(() => 400);
		await host.send('start');
		await host.send('enable', 1, 560);
		expect(host.wrapper.text()).toBe('0');
		expect(host.reply).toHaveBeenCalledWith(expect.objectContaining({ accepted: false }), '*');
		host.dispose();
	});

	it('clears height on sandbox replacement and detaches on host unmount', async () => {
		const host = setup();
		await host.send('start');
		await host.send('enable');
		host.sandbox.value = { container: document.createElement('div') };
		await nextTick();
		expect(host.wrapper.text()).toBe('0');
		host.dispose();
		const count = host.reply.mock.calls.length;
		await host.send('enable');
		expect(host.reply.mock.calls).toHaveLength(count);
	});
});
