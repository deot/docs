// @vitest-environment jsdom

import type { DocsConfig, DocsRuntime } from '../src/types';

const { gateway, runtime, config } = vi.hoisted(() => {
	const nextRuntime: DocsRuntime = { mode: 'development', events: '/__docs/events' };
	const nextConfig: DocsConfig = {
		locales: { 'zh-CN': { label: '简体中文' }, 'en-US': { label: 'English' } },
		routes: {},
		namespace: 'events-test'
	};
	return {
		gateway: {
			isSubscribed: vi.fn(),
			isPrefetched: vi.fn(),
			revalidate: vi.fn(() => Promise.resolve()),
			invalidate: vi.fn(() => Promise.resolve())
		},
		runtime: nextRuntime,
		config: nextConfig
	};
});

vi.mock('../src/modules/gateway', () => ({ Gateway: gateway }));
vi.mock('../src/utils/runtime', () => ({
	getDocsRuntime: () => runtime,
	getDocsConfig: () => config
}));

class MockEventSource {
	static instances: MockEventSource[] = [];

	onmessage?: (message: MessageEvent<string>) => void;

	close = vi.fn();

	constructor(public url: string) {
		MockEventSource.instances.push(this);
	}

	emit(value: unknown) {
		this.onmessage?.({ data: typeof value === 'string' ? value : JSON.stringify(value) } as MessageEvent<string>);
	}
}

describe('resource SSE events', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		MockEventSource.instances.length = 0;
		vi.stubGlobal('EventSource', MockEventSource);
		runtime.mode = 'development';
		runtime.events = '/__docs/events';
	});

	it('does nothing outside a configured development runtime', async () => {
		const { connectResourceEvents } = await import('../src/events');
		runtime.mode = 'production';
		connectResourceEvents()();
		expect(MockEventSource.instances).toHaveLength(0);

		runtime.mode = 'development';
		delete runtime.events;
		connectResourceEvents()();
		expect(MockEventSource.instances).toHaveLength(0);
	});

	it('revalidates only subscribed resources and handles unlink', async () => {
		const { connectResourceEvents } = await import('../src/events');
		gateway.isSubscribed.mockReturnValue(true);
		const disconnect = connectResourceEvents();
		const source = MockEventSource.instances[0];
		expect(source.url).toBe('/__docs/events');

		source.emit('invalid json');
		source.emit(null);
		source.emit({
			type: 'unknown', lang: 'zh-CN', source: './unknown.md',
			resourceType: 'markdown', timestamp: 1
		});
		source.emit({
			type: 'change', lang: 'zh-CN', source: './unknown.md',
			resourceType: 'unknown', timestamp: 1
		});
		source.emit({ type: 'change', timestamp: 1 });
		gateway.isSubscribed.mockReturnValue(false);
		gateway.isPrefetched.mockReturnValue(false);
		source.emit({
			type: 'change', lang: 'zh-CN', source: './ignored.md', resourceType: 'markdown', timestamp: 2
		});
		expect(gateway.revalidate).not.toHaveBeenCalled();

		gateway.isPrefetched.mockReturnValue(true);
		source.emit({
			type: 'change', lang: 'zh-CN', source: './prefetched.md', resourceType: 'markdown', timestamp: 2
		});
		expect(gateway.revalidate).toHaveBeenCalledWith(expect.objectContaining({
			source: './prefetched.md'
		}), { priority: 75, trailing: true });

		gateway.isSubscribed.mockReturnValue(true);
		source.emit({
			type: 'change', lang: 'zh-CN', source: './index.md', resourceType: 'markdown', timestamp: 3
		});
		expect(gateway.revalidate).toHaveBeenCalledWith(expect.objectContaining({
			namespace: 'events-test', source: './index.md'
		}), { priority: 75, trailing: true });

		source.emit({
			type: 'unlink', lang: 'zh-CN', source: './index.md', resourceType: 'markdown', timestamp: 4
		});
		expect(gateway.revalidate).toHaveBeenLastCalledWith(expect.objectContaining({
			namespace: 'events-test', source: './index.md'
		}), { priority: 75, trailing: true });
		expect(gateway.invalidate).not.toHaveBeenCalled();

		gateway.isSubscribed.mockImplementation(identity => identity.lang === 'en-US');
		gateway.isPrefetched.mockReturnValue(false);
		source.emit({
			type: 'change',
			lang: '',
			source: 'packages/client/README.md',
			resourceType: 'markdown',
			timestamp: 5
		});
		expect(gateway.revalidate).toHaveBeenLastCalledWith(expect.objectContaining({
			lang: 'en-US',
			source: 'packages/client/README.md'
		}), { priority: 75, trailing: true });
		disconnect();
		expect(source.close).toHaveBeenCalledOnce();
	});
});
