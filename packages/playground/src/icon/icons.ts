export const PLAYGROUND_ICON_PATHS = {
	runtime: 'M5 3h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 18h8m-4-3v3m-2-13 5 3-5 3V8Z',
	files: 'M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm8 0v6h5m-9 5-2 2 2 2m5-4 2 2-2 2',
	copy: 'M9 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2Zm-2 8H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4',
	editor: 'M8 8 4 12l4 4m8-8 4 4-4 4m-3-10-2 12',
	viewport: 'M3 4h12v10H3V4Zm3 14h6m-3-4v4m9-9h3v11h-6V9h3m0 9h0'
} as const;

export type PlaygroundIconName = keyof typeof PLAYGROUND_ICON_PATHS;
