import { IconManager } from '@deot/vc';
import { isDirectImageSource } from '../../shared/image-source';

export const featureIconKind = (value: unknown): 'url' | 'type' | 'none' => {
	const icon = String(value || '').trim();
	if (!icon) return 'none';
	return isDirectImageSource(icon) ? 'url' : 'type';
};

export const listBuiltinIconTypes = () => Object.keys(IconManager.icons).sort((left, right) => left.localeCompare(right));
