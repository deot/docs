import type { DocsConfig } from '../types';

export const getDocsHistoryMode = (
	config: Pick<DocsConfig, 'history'>,
	protocol = location.protocol
) => config.history ?? (/^https?:$/u.test(protocol) ? 'html5' : 'hash');
