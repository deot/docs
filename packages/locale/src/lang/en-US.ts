import type { Language } from '../types';

const enUS = {
	name: 'en-US',
	client: {
		common: {
			close: 'Close',
			invalidSidebar: 'Invalid sidebar resource',
			loading: 'Loading…',
			poweredBy: 'Powered by @deot/docs',
			resourceRequestFailed: 'Resource request failed',
			yes: 'Yes'
		},
		header: {
			brand: '@deot/docs',
			database: 'Open resource database',
			language: 'Switch language',
			switchToDark: 'Switch to dark theme',
			switchToLight: 'Switch to light theme'
		},
		search: {
			trigger: 'Search docs',
			untitled: 'Untitled',
			dialogLabel: 'Search documentation',
			placeholder: 'Search docs',
			clearQuery: 'Clear query',
			close: 'Close search',
			searching: 'Searching…',
			documentation: 'Documentation',
			noResults: 'No results found.',
			noCachedDocuments: 'No cached documents yet.',
			recent: 'Recent',
			noRecent: 'No recent searches.',
			pin: 'Pin history',
			unpin: 'Unpin history',
			remove: 'Remove history',
			navigateHint: 'to navigate',
			selectHint: 'to select',
			closeHint: 'to close',
			historyLoadFailed: 'Unable to load search history.',
			queryFailed: 'Unable to search cached documents.',
			historyUpdateFailed: 'Unable to update search history.',
			historyRemoveFailed: 'Unable to remove search history.'
		},
		database: {
			title: 'IndexedDB Resources',
			back: 'Back',
			home: 'Home',
			records: '{count} records',
			cache: 'cache {size}',
			columns: 'Columns',
			refresh: 'Refresh',
			updateAll: 'Update all',
			prefetch: 'Prefetch',
			clear: 'Clear',
			prune: 'Prune',
			url: 'URL',
			source: 'Source',
			contentStatus: 'Content Status',
			requestStatus: 'Request Status',
			namespace: 'Namespace',
			language: 'Language',
			type: 'Type',
			hash: 'Hash',
			content: 'Content',
			updated: 'Updated',
			checked: 'Checked',
			accessed: 'Accessed',
			previous: 'Previous',
			actions: 'Actions',
			update: 'Update',
			delete: 'Delete',
			loadFailed: 'Load failed',
			operationFailed: 'Operation failed',
			refreshed: 'Refreshed',
			reloadFailed: 'Reload failed',
			updatedSource: '{source} updated',
			deletedSource: '{source} deleted',
			updatedAll: 'Updated all',
			clearedAll: 'Cleared all',
			prefetchSummary: 'Prefetch: {fulfilled} ok, {rejected} failed',
			prefetched: 'Prefetched {total}',
			prefetchFailed: 'Prefetch failed',
			pruned: 'Pruned {count}',
			pruneFailed: 'Garbage cleanup failed'
		},
		paging: {
			search: 'Search',
			reset: 'Reset',
			enter: 'Enter',
			select: 'Select',
			pickDate: 'Pick date',
			min: 'Min',
			max: 'Max'
		}
	},
	markdown: {
		indicator: {
			label: 'Document indicator',
			untitled: 'Untitled section',
			document: 'Document'
		}
	},
	playground: {
		common: {
			copy: 'Copy',
			copyCode: 'Copy code',
			copyCurrentFile: 'Copy current file',
			close: 'Close'
		},
		runtime: {
			preview: 'Runtime preview',
			files: 'File preview',
			auto: 'Auto',
			viewport: 'Viewport: {value}',
			viewportMenu: 'Runtime viewport',
			editFiles: 'Edit files'
		},
		files: {
			entry: 'Entry'
		},
		editor: {
			entry: 'Entry file',
			entryCannotDelete: 'The entry file cannot be deleted',
			confirmDelete: 'Delete {filename}?',
			deleteFile: 'Delete file',
			createFile: 'Create file',
			setEntry: 'Set as entry'
		},
		validation: {
			entryMissing: 'Entry file {filename} does not exist',
			filenameRequired: 'Enter a filename',
			filenameRelative: 'The filename must be a relative POSIX path',
			filenameSegments: 'The path cannot contain empty, . or .. segments',
			fileTypeUnsupported: 'Unsupported file type',
			filenameExists: 'The filename already exists'
		}
	}
} as const satisfies Language;

export default enUS;
