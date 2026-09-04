import { Portal } from '@deot/vc';
import AloneView from './wrapper.vue';

export const Alone = new Portal(AloneView, {
	name: 'docs-playground-alone',
	leaveDelay: 0,
	multiple: false
});

export {
	PLAYGROUND_POPUP_HEADER_HEIGHT,
	PLAYGROUND_POPUP_SCREEN_GAP,
	resolvePopupLayout,
	resolvePopupRequestedSize
} from './layout';
