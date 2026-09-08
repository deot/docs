// @vitest-environment jsdom

import {
	resolveDocsComponents,
	resolveDocsMarkdownComponent,
	resolveDocsMarkdownTheme,
	resolveDocsPlaygroundComponent,
	resolveDocsRendererComponent
} from '../src/utils/components';

describe('docs components config', () => {
	it('resolves markdown theme with a default fallback', () => {
		expect(resolveDocsMarkdownTheme('traditional')).toBe('traditional');
		expect(resolveDocsMarkdownTheme('default')).toBe('default');
		expect(resolveDocsMarkdownTheme('unknown')).toBe('default');
		expect(resolveDocsMarkdownTheme(undefined)).toBe('default');
		expect(resolveDocsMarkdownComponent({}).theme).toBe('default');
		expect(resolveDocsMarkdownComponent({
			components: { markdown: { theme: 'traditional', indicator: false } }
		})).toEqual({ theme: 'traditional', indicator: false });
	});

	it('copies playground defaults and validates renderer fit', () => {
		expect(resolveDocsPlaygroundComponent({})).toEqual({});
		expect(resolveDocsPlaygroundComponent({
			components: { playground: { previewInset: 16, expandable: true } }
		})).toEqual({ previewInset: 16, expandable: true });
		expect(resolveDocsRendererComponent({
			components: { renderer: { fit: 'contain' } }
		})).toEqual({ fit: 'contain' });
		expect(resolveDocsRendererComponent({
			components: { renderer: { fit: 'invalid' as 'width' } }
		})).toEqual({});
		expect(resolveDocsComponents({
			components: {
				markdown: { theme: 'traditional' },
				playground: { previewInset: 16 },
				renderer: { fit: 'width' }
			}
		})).toEqual({
			markdown: { theme: 'traditional' },
			playground: { previewInset: 16 },
			renderer: { fit: 'width' }
		});
	});
});
