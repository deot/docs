// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { Clipboard, ColorPicker, Input, Scroller, Textarea } from '@deot/vc';
import { enUS } from '@deot/docs-locale';
import type { RendererModuleContext, RendererSortableNode } from '../src';
import { CodeModule } from '../src/modules/sortable/code';
import CodeViewer from '../src/modules/sortable/code/viewer.vue';
import CodeEditor from '../src/modules/sortable/code/editor.vue';
import ArrayEditor from '../src/editor/array/index.vue';
import { highlightCodeLines } from '../src/modules/shared/code-highlight';

const context: RendererModuleContext = { scene: 'combo', frameMode: 'sortable', readonly: false, locale: enUS };
const value = {
	title: 'Deploy', align: 'center', filename: 'index.html', language: 'html',
	content: '<main>\n  <h1>Hello</h1>\n  <p>Docs</p>\n</main>',
	accent: '', background: '', textColor: '',
	folds: [{ start: 2, end: 3, label: 'Content' }], highlightLines: [1, 4]
};
const nodeOf = (props: Record<string, unknown>): RendererSortableNode => ({
	id: 'code', module: { type: 'code', version: 1, props },
	appearance: { marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }
});

describe('code showcase module', () => {
	afterEach(() => vi.useRealTimers());

	it('normalizes and validates line ranges without losing source or custom colors', () => {
		const configured = { ...value, align: 'right', accent: '#0d9488', background: '#f0fdfa', textColor: '#134e4a' };
		const normalized = CodeModule.data.normalize!(configured);
		expect(normalized).toMatchObject(configured);
		expect(CodeModule.data.validate!(normalized)).toEqual([]);
		expect(CodeModule.data.normalize!({})).toMatchObject({
			align: 'center', accent: '', background: '', textColor: '', folds: [], highlightLines: []
		});
		expect(CodeModule.data.validate!({ ...normalized, folds: [{ start: 0, end: 6, label: '' }], highlightLines: [1.5] }))
			.toEqual(expect.arrayContaining([
				expect.objectContaining({ path: '$.folds[0].start', code: 'number.min' }),
				expect.objectContaining({ path: '$.folds[0].end', code: 'number.max' }),
				expect.objectContaining({ path: '$.highlightLines[0]', code: 'number.integer' })
			]));
		expect(CodeModule.data.validate!({ ...normalized, folds: [{ start: 1, end: 3, label: '' }, { start: 3, end: 4, label: '' }] }))
			.toContainEqual(expect.objectContaining({ code: 'fold.overlap' }));
		expect(CodeModule.integrations?.collectSearchText?.(normalized)).toEqual([
			{ title: 'Deploy', text: `index.html ${value.content}` }
		]);
	});

	it('keeps embedded-language and multiline syntax intact in independently balanced code rows', () => {
		const source = '<script>\n/* multi\nline */\nconst title = "Hello";\n</script>';
		const lines = highlightCodeLines(source, 'html');
		expect(lines).toHaveLength(5);
		expect(highlightCodeLines(source.replace(/\n/gu, '\r\n'), 'html')).toEqual(lines);
		for (const line of lines) {
			expect(line.match(/<span\b/gu)?.length || 0).toBe(line.match(/<\/span>/gu)?.length || 0);
		}
		expect(lines[2]).toContain('hljs-comment');
		expect(lines[3]).toContain('hljs-keyword');
		const element = document.createElement('div');
		element.innerHTML = lines.join('\n');
		expect(element.textContent).toBe(source);
	});

	it('folds configured ranges, expands complete code and copies the full source while collapsed', async () => {
		vi.useFakeTimers();
		const wrapper = mount(CodeViewer, { props: { node: nodeOf(value), context } });
		expect(wrapper.findAll('.docs-renderer-code__line')).toHaveLength(3);
		expect(wrapper.findAll('.is-key')).toHaveLength(2);
		expect(wrapper.get('.docs-renderer-code__fold').text().replace(/\s+/gu, ' ')).toBe('›Content · Expand 2 lines');
		const clipboard = wrapper.findComponent(Clipboard);
		expect(clipboard.props('value')).toBe(value.content);
		(clipboard.vm.$.vnode.props!.onAfter as () => void)();
		await wrapper.vm.$nextTick();
		expect(wrapper.get('.docs-renderer-code__copy').text()).toBe('Copied');
		await vi.advanceTimersByTimeAsync(1800);
		expect(wrapper.get('.docs-renderer-code__copy').text()).toBe('Copy');
		await wrapper.get('.docs-renderer-code__fold').trigger('click');
		expect(wrapper.findAll('.docs-renderer-code__line')).toHaveLength(4);
		expect(wrapper.findAll('.docs-renderer-code__source').map(row => row.text()).join('\n')).toContain('Hello');
		expect(wrapper.get('.docs-renderer-code__expand').attributes('aria-expanded')).toBe('true');
		expect(wrapper.findComponent(Scroller).props()).toMatchObject({ native: false, autoResize: true, showBar: true });
		await wrapper.get('.docs-renderer-code__expand').trigger('click');
		expect(wrapper.findAll('.docs-renderer-code__line')).toHaveLength(3);
		wrapper.unmount();
	});

	it('escapes unsupported languages, ignores invalid folds and refreshes when the source changes', async () => {
		const wrapper = mount(CodeViewer, { props: {
			node: nodeOf({ ...value, language: 'unknown', content: '<img src=x onerror=alert(1)>', folds: [{ start: -1, end: 999 }] }), context
		} });
		expect(wrapper.find('img').exists()).toBe(false);
		expect(wrapper.get('.docs-renderer-code__source').text()).toBe('<img src=x onerror=alert(1)>');
		expect(wrapper.find('.docs-renderer-code__fold').exists()).toBe(false);
		await wrapper.setProps({ node: nodeOf(value) });
		await wrapper.get('.docs-renderer-code__expand').trigger('click');
		await wrapper.setProps({ node: nodeOf({ ...value, content: '<main>\n  Updated\n</main>', folds: [{ start: 2, end: 2, label: '' }] }) });
		expect(wrapper.classes()).not.toContain('is-expanded');
		expect(wrapper.get('.docs-renderer-code__fold').text()).toContain('Expand 1 lines');
		wrapper.unmount();
	});

	it('inherits theme colors by default and applies module overrides independently', async () => {
		const wrapper = mount(CodeViewer, { props: { node: nodeOf(value), context } });
		expect(wrapper.attributes('style') || '').not.toContain('--docs-renderer-accent');
		await wrapper.setProps({ node: nodeOf({ ...value, accent: '#0d9488', background: '#f0fdfa', textColor: '#134e4a' }) });
		expect(wrapper.attributes('style')).toContain('--docs-renderer-code-accent: #0d9488');
		expect(wrapper.attributes('style')).toContain('--docs-renderer-code-paper: #f0fdfa');
		expect(wrapper.attributes('style')).toContain('--docs-renderer-ink: #134e4a');
		wrapper.unmount();
	});

	it('edits colors, code, file metadata, folds and highlighted lines without discarding other fields', async () => {
		const wrapper = mount(CodeEditor, { props: { node: nodeOf(value), modelValue: value, context } });
		for (const [index, field] of ['accent', 'background', 'textColor'].entries()) {
			wrapper.findAllComponents(ColorPicker)[index].vm.$emit('update:modelValue', '#0d9488');
			expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({ ...value, [field]: '#0d9488' });
		}
		wrapper.findAllComponents(Textarea).at(-1)!.vm.$emit('update:modelValue', 'const updated = true;');
		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({ ...value, content: 'const updated = true;' });
		wrapper.findAllComponents(Input).find(input => input.props('modelValue') === 'index.html')!.vm.$emit('update:modelValue', 'config.js');
		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({ ...value, filename: 'config.js' });
		wrapper.findAllComponents(Input).find(input => input.props('modelValue') === '1, 4')!.vm.$emit('update:modelValue', '2， 3, 3, -1, abc');
		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({ ...value, highlightLines: [2, 3] });
		wrapper.findComponent(ArrayEditor).vm.$emit('update:modelValue', []);
		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toEqual({ ...value, folds: [] });
		wrapper.unmount();
	});
});
