export const CLIENT_ICON_DEFINITIONS = {
	language: {
		filled: true,
		path: [
			'm18.5 10 4.4 11h-2.155l-1.201-3h-4.09l-1.199 3h-2.154L16.5 10z',
			'M10 2v2h6v2h-1.968a18.2 18.2 0 0 1-3.62 6.301 15 15 0 0 0 2.335 1.707',
			'l-.75 1.878A17 17 0 0 1 9 13.725a16.7 16.7 0 0 1-6.201 3.548l-.536-1.929',
			'a14.7 14.7 0 0 0 5.327-3.042A18 18 0 0 1 4.767 8h2.24A16 16 0 0 0 9 10.877',
			'a16.2 16.2 0 0 0 2.91-4.876L2 6V4h6V2zm7.5 10.885L16.253 16h2.492z'
		].join('')
	},
	sun: {
		filled: false,
		path: [
			'M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12M12 2V0m0 24v-2',
			'M4.22 4.22 2.8 2.8m18.4 18.4-1.42-1.42M2 12H0m24 0h-2',
			'M4.22 19.78 2.8 21.2M21.2 2.8l-1.42 1.42'
		].join('')
	},
	moon: {
		filled: false,
		path: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79'
	},
	database: {
		filled: false,
		path: [
			'M4 6c0-1.66 3.58-3 8-3s8 1.34 8 3-3.58 3-8 3-8-1.34-8-3Z',
			'M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6'
		].join('')
	},
	playgroundResource: {
		filled: false,
		path: [
			'M3 4.5h18v3H3zm0 6h12v3H3zm0 6h18v3H3z',
			'M16.5 8.25 22 12l-5.5 3.75V8.25z'
		].join('')
	},
	editor: {
		filled: false,
		path: [
			'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
			'M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84',
			'a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z'
		].join('')
	},
	more: {
		filled: false,
		path: [
			'M4 4h6v6H4zm10 0h6v6h-6z',
			'M4 14h6v6H4zm10 0h6v6h-6z'
		].join('')
	},
	menu: {
		filled: false,
		path: 'M4 7h16M4 12h16M4 17h16'
	},
	close: {
		filled: false,
		path: 'm6 6 12 12M18 6 6 18'
	},
	back: {
		filled: false,
		path: 'M19 12H5m6-6-6 6 6 6'
	},
	home: {
		filled: false,
		path: 'M3 11 12 3l9 8M5 10v10h14V10M9 20v-6h6v6'
	}
} as const;

export type ClientIconName = keyof typeof CLIENT_ICON_DEFINITIONS;
