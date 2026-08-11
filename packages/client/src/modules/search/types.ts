export interface SearchNavigationTarget {
	namespace: string;
	lang: string;
	path: string;
	hash: string;
	title: string;
	sectionTitle?: string;
}

export interface SearchResult extends SearchNavigationTarget {
	id: string;
	kind: 'document' | 'section';
	source: string;
	excerpt: string;
	score: number;
}

export interface SearchHistoryRecord extends SearchNavigationTarget {
	id: string;
	pinned: boolean;
	pinnedAt?: number;
	visitedAt: number;
}

export interface SearchPreparedDocument {
	key: string;
	hash: string;
	namespace: string;
	lang: string;
	path: string;
	source: string;
	title: string;
	text: string;
	sections: Array<{
		title: string;
		anchor: string;
		text: string;
	}>;
}
