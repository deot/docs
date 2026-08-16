import { Portal } from '@deot/vc';
import { createRendererId } from '../../../utils/id';
import Paint from './paint.vue';

export const createAreaPaintPortal = () => new Portal(Paint, {
	name: `docs-renderer-area-paint-${createRendererId()}`,
	leaveDelay: 0,
	multiple: false
});
