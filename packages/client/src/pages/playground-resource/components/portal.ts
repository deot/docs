import { Portal } from '@deot/vc';
import SourceEditorView from './source-editor.vue';

/**
 * Playground 资源地址编辑弹层。与搜索/预览一致：单例先销毁旧实例，再打开新会话。
 */
export const SourceEditor = new Portal(SourceEditorView, {
	name: 'docs-playground-resource-source-editor',
	leaveDelay: 0,
	multiple: false
});
