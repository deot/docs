import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
	compileWorkspaceModule,
	getWorkspaceModuleBuildCount,
	resetWorkspaceModuleCache,
	resolveWorkspaceModuleEntries,
	respondWorkspaceModule
} from '../src/workspace-module';
import { default as createDocsPlugins } from '../src/plugins';
import { findPlugin, pluginHook } from './fixtures';

// @vitest-environment node
describe('workspace modules', () => {
	const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

	const createResponse = () => ({
		statusCode: 200,
		setHeader: vi.fn(),
		end: vi.fn(),
		writableEnded: false
	}) as unknown as import('node:http').ServerResponse;

	beforeEach(() => {
		resetWorkspaceModuleCache();
	});

	it('discovers source entries inside the project and ignores escaped packages', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-module-scan-'));
		const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-module-outside-'));
		try {
			fs.mkdirSync(path.join(root, 'packages/alpha/src'), { recursive: true });
			fs.mkdirSync(path.join(root, 'packages/beta'), { recursive: true });
			fs.mkdirSync(path.join(root, 'packages/plain'), { recursive: true });
			fs.writeFileSync(path.join(root, 'packages/alpha/package.json'), JSON.stringify({
				name: '@example/alpha'
			}));
			fs.writeFileSync(path.join(root, 'packages/alpha/src/index.ts'), 'export const alpha = 1;\n');
			fs.writeFileSync(path.join(root, 'packages/alpha/index.ts'), 'export const ignored = 1;\n');
			fs.writeFileSync(path.join(root, 'packages/beta/package.json'), JSON.stringify({
				name: '@example/beta'
			}));
			fs.writeFileSync(path.join(root, 'packages/beta/index.ts'), 'export const beta = 1;\n');
			fs.writeFileSync(path.join(root, 'packages/plain/package.json'), JSON.stringify({
				name: '@example/plain'
			}));
			fs.mkdirSync(path.join(outside, 'escaped'));
			fs.writeFileSync(path.join(outside, 'escaped/package.json'), JSON.stringify({
				name: '@example/escaped'
			}));
			fs.writeFileSync(path.join(outside, 'escaped/index.ts'), 'export const escaped = 1;\n');
			fs.symlinkSync(path.join(outside, 'escaped'), path.join(root, 'packages/escaped'));

			expect(resolveWorkspaceModuleEntries(root).map(item => ({
				name: item.name,
				entry: path.basename(path.dirname(item.entry)) === 'src'
					? 'src/index.ts'
					: 'index.ts'
			})).sort((left, right) => left.name.localeCompare(right.name))).toEqual([
				{ name: '@example/alpha', entry: 'src/index.ts' },
				{ name: '@example/beta', entry: 'index.ts' }
			]);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
			fs.rmSync(outside, { recursive: true, force: true });
		}
	});

	it('compiles vue, tsx and scss while leaving vue and sibling packages bare', async () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-module-build-'));
		fs.mkdirSync(path.join(root, 'packages/widget/src'), { recursive: true });
		fs.mkdirSync(path.join(root, 'packages/sibling/src'), { recursive: true });
		fs.writeFileSync(path.join(root, 'packages/sibling/package.json'), JSON.stringify({
			name: '@example/sibling'
		}));
		fs.writeFileSync(
			path.join(root, 'packages/sibling/src/index.ts'),
			'export const value = 1;\n'
		);
		fs.writeFileSync(path.join(root, 'packages/widget/package.json'), JSON.stringify({
			name: '@example/widget'
		}));
		fs.writeFileSync(path.join(root, 'packages/widget/src/widget.vue'), [
			'<template><button class="demo">{{ label }}</button></template>',
			'<script setup>',
			'import { ref } from \'vue\';',
			'const label = ref(\'ready\');',
			'</script>',
			'<style lang="scss">',
			'.demo { color: red; }',
			'</style>'
		].join('\n'));
		fs.writeFileSync(path.join(root, 'packages/widget/src/badge.tsx'), [
			'/** @jsxImportSource vue */',
			'import { defineComponent } from \'vue\';',
			'export const Badge = defineComponent({',
			'\tsetup() {',
			'\t\treturn () => <span>badge</span>;',
			'\t}',
			'});',
			''
		].join('\n'));
		fs.writeFileSync(path.join(root, 'packages/widget/src/index.ts'), [
			'import { ref } from \'vue\';',
			'import { value } from \'@example/sibling\';',
			'import { Badge } from \'./badge\';',
			'import Widget from \'./widget.vue\';',
			'export const marker = \'local-marker\';',
			'export { ref, value, Badge, Widget };',
			''
		].join('\n'));
		fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(root, 'node_modules'));
		const entry = resolveWorkspaceModuleEntries(root).find(item => item.name === '@example/widget');
		if (!entry) throw new Error('missing widget entry');
		try {
			const code = await compileWorkspaceModule(root, entry);
			expect(code).toContain('local-marker');
			expect(code).toMatch(/from\s+["']vue["']/);
			expect(code).toMatch(/from\s+["']@example\/sibling["']/);
			expect(code).toContain('color: red');
			expect(code).toContain('data-docs-module');
			expect(getWorkspaceModuleBuildCount()).toBe(1);
			expect(await compileWorkspaceModule(root, entry)).toBe(code);
			expect(getWorkspaceModuleBuildCount()).toBe(1);
			fs.writeFileSync(
				path.join(root, 'packages/widget/src/index.ts'),
				`${fs.readFileSync(path.join(root, 'packages/widget/src/index.ts'), 'utf8')}export const next = 2;\n`
			);
			const next = await compileWorkspaceModule(root, entry);
			expect(next).toContain('next');
			expect(getWorkspaceModuleBuildCount()).toBe(2);

			const response = createResponse();
			await respondWorkspaceModule({
				url: '/__docs/module/@example/missing',
				method: 'GET'
			} as import('node:http').IncomingMessage, response, root);
			expect(response.statusCode).toBe(404);

			const escaped = createResponse();
			await respondWorkspaceModule({
				url: '/__docs/module/..%2Fsecret',
				method: 'GET'
			} as import('node:http').IncomingMessage, escaped, root);
			expect(escaped.statusCode).toBe(404);
		} finally {
			fs.rmSync(root, { recursive: true, force: true });
		}
	}, 60_000);

	it('keeps preview from serving compiled workspace modules', () => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-module-preview-'));
		fs.mkdirSync(path.join(root, 'site'), { recursive: true });
		fs.writeFileSync(path.join(root, 'site/index.html'), '<div />');
		const restoreCwd = vi.spyOn(process, 'cwd').mockReturnValue(root);
		try {
			const middlewares: Array<(...args: unknown[]) => unknown> = [];
			const server = {
				config: { root: path.join(root, 'site') },
				middlewares: {
					use: vi.fn((handler: (...args: unknown[]) => unknown) => {
						if (typeof handler === 'function') middlewares.push(handler);
					})
				},
				watcher: { add: vi.fn(), on: vi.fn() },
				httpServer: { once: vi.fn() }
			};
			pluginHook(
				findPlugin(createDocsPlugins({ workspace: 'site', preview: true }), 'docs-workspace-resources')
					.configureServer,
				'configureServer'
			)(server);
			const response = createResponse();
			middlewares[0]({
				url: '/__docs/module/@example/widget',
				method: 'GET',
				headers: {}
			}, response, vi.fn());
			expect(response.statusCode).toBe(404);
			expect(response.end).toHaveBeenCalledWith('Not Found');
		} finally {
			restoreCwd.mockRestore();
			fs.rmSync(root, { recursive: true, force: true });
		}
	});
});
