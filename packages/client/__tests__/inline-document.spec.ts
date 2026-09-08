// @vitest-environment jsdom

import {
	stashInlineRendererDocument,
	takeInlineRendererDocument
} from '../src/pages/renderer-editor/inline';

const document = {
	schemaVersion: 2 as const,
	meta: { id: 'campaign', title: 'Campaign' },
	layout: { mode: 'sortable' as const, maxWidth: 1180, minHeight: 600, background: '#fff' },
	blocks: []
};

describe('inline renderer documents', () => {
	beforeEach(() => sessionStorage.clear());

	it('ignores missing, malformed and mismatched session payloads', () => {
		expect(takeInlineRendererDocument('/en-US')).toBeUndefined();
		sessionStorage.setItem('docs-renderer-inline-document', '{');
		expect(takeInlineRendererDocument('/en-US')).toBeUndefined();
		sessionStorage.setItem('docs-renderer-inline-document', '[]');
		expect(takeInlineRendererDocument('/en-US')).toBeUndefined();
		sessionStorage.setItem('docs-renderer-inline-document', JSON.stringify({ document }));
		expect(takeInlineRendererDocument('/en-US')).toBeUndefined();
		sessionStorage.setItem('docs-renderer-inline-document', JSON.stringify({
			from: '/en-US',
			document: { schemaVersion: 1 }
		}));
		expect(takeInlineRendererDocument('/en-US')).toBeUndefined();
		sessionStorage.setItem('docs-renderer-inline-document', JSON.stringify({
			from: '/en-US/other',
			document
		}));
		expect(takeInlineRendererDocument('/en-US')).toBeUndefined();
	});

	it('stashes a valid document and restores it once', () => {
		stashInlineRendererDocument('/en-US', { schemaVersion: 1 });
		expect(sessionStorage.getItem('docs-renderer-inline-document')).toBeNull();
		stashInlineRendererDocument('/en-US', document);
		expect(takeInlineRendererDocument('/en-US')?.meta.title).toBe('Campaign');
	});

	it('keeps navigation working when session storage rejects the payload', () => {
		const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('quota');
		});
		expect(() => stashInlineRendererDocument('/en-US', document)).not.toThrow();
		setItem.mockRestore();
	});
});
