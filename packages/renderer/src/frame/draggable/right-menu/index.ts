import { Portal } from '@deot/vc';
import RightMenu from './index.vue';

export { RENDERER_RIGHT_MENU, RENDERER_RIGHT_MENU_ORDER } from './constants';
export type { RendererRightMenuAction } from './constants';

export const createRightMenuPortal = () => new Portal(RightMenu, {
	name: 'docs-renderer-right-menu',
	el: typeof document === 'undefined' ? 'body' : document.body,
	fragment: true,
	leaveDelay: 0,
	multiple: false
});
