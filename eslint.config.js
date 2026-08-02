import { configure } from '@deot/dev-eslint';
import tsParser from '@typescript-eslint/parser';
import vueParser from 'vue-eslint-parser';

export default configure(void 0, {
	files: ['*.vue', '**/*.vue'],
	languageOptions: {
		parser: vueParser,
		parserOptions: {
			parser: {
				'js': 'espree',
				'ts': tsParser,
				'<template>': 'espree'
			}
		}
	},
	rules: {
		'no-unused-vars': 'off',
		'@typescript-eslint/no-unused-vars': 'warn'
	}
});
