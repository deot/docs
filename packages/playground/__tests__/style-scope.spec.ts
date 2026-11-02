import { liftPreviewScope } from '../src/core/runtime/local/compile/style-scope';

const scope = 'docs-local-root';
const root = `[data-playground-scope="${scope}"]`;

describe('preview style scope', () => {
	it('moves the element scope attribute onto the preview root', () => {
		const css = [
			'@charset "UTF-8";',
			'.audit-row[data-v-docs-local-root] { display: flex; gap: 10px; }',
			'@media (width <= 760px) {',
			'.audit-layout[data-v-docs-local-root] { gap: 16px; }',
			'}',
			':where(.a[data-v-docs-local-root], .b[data-v-docs-local-root]) { color: red; }',
			'.a[title="a,b"][data-v-docs-local-root], .b[data-v-docs-local-root] { color: red; }',
			'/* [data-v-docs-local-root] */',
			'.kept[data-v-docs-local-root] { color: red; }',
			'.quoted[title="[data-v-docs-local-root]"][data-v-docs-local-root] { color: red; }'
		].join('\n');
		expect(liftPreviewScope(css, scope)).toBe([
			'@charset "UTF-8";',
			`${root} .audit-row { display: flex; gap: 10px; }`,
			'@media (width <= 760px) {',
			`${root} .audit-layout { gap: 16px; }`,
			'}',
			`${root} :where(.a, .b) { color: red; }`,
			`${root} .a[title="a,b"], ${root} .b { color: red; }`,
			`${root} /* [data-v-docs-local-root] */`,
			`.kept { color: red; }`,
			`${root} .quoted[title="[data-v-docs-local-root]"] { color: red; }`
		].join('\n'));
	});

	it('keeps keyframe bodies and declaration strings intact', () => {
		const css = [
			'@keyframes spin-docs-local-root {',
			'from { opacity: 0; }',
			'to { opacity: 1; }',
			'}',
			'.box[data-v-docs-local-root] {',
			'animation: spin-docs-local-root 1s;',
			'content: "[data-v-docs-local-root]";',
			'}',
			'.plain { color: red; }'
		].join('\n');
		expect(liftPreviewScope(css, scope)).toBe([
			'@keyframes spin-docs-local-root {',
			'from { opacity: 0; }',
			'to { opacity: 1; }',
			'}',
			`${root} .box {`,
			'animation: spin-docs-local-root 1s;',
			'content: "[data-v-docs-local-root]";',
			'}',
			'.plain { color: red; }'
		].join('\n'));
	});

	it('returns css unchanged when the generated attribute is absent', () => {
		const css = '.a { content: "[data-v-other]"; }';
		expect(liftPreviewScope(css, scope)).toBe(css);
		expect(liftPreviewScope('.a { color: red; }', scope)).toBe('.a { color: red; }');
	});

	it('rejects a scope value that cannot be embedded in a selector', () => {
		expect(() => liftPreviewScope('.a{}', 'bad scope')).toThrow(/无效的样式隔离标记/);
	});
});
