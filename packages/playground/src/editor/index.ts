import { Portal } from '@deot/vc';
import EditorWrapper from './editor.vue';

export type { EditorFilesChange, EditorFilesChangeAction } from './types';

export const Editor = new Portal(EditorWrapper, {
	aliveRegExp: { className: /(PORTAL_TAG_DISABLE)/ },
});
