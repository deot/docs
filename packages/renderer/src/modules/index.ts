import type { RendererModuleSource } from '../types';
import { DraggableOnlyModules } from './draggable';
import { ActionsModule } from './shared/actions';
import { ImageModule } from './shared/image';
import { ListModule } from './shared/list';
import { PageModule } from './shared/page';
import { SelectionModule } from './shared/selection';
import { TextModule } from './shared/text';
import { TitleModule } from './shared/title';
import { AreaModule } from './sortable/area';
import { CtaModule } from './sortable/cta';
import { FaqModule } from './sortable/faq';
import { FeaturesModule } from './sortable/features';
import { HeroModule } from './sortable/hero';
import { AdsModule } from './sortable/promo';
import { SpaceModule } from './sortable/space';
import { StepsModule } from './sortable/steps';

export { DraggableOnlyModules };

export const BuiltinModules = Object.freeze<readonly RendererModuleSource[]>([
	PageModule,
	SelectionModule,
	SpaceModule,
	TitleModule,
	TextModule,
	ListModule,
	ImageModule,
	AreaModule,
	ActionsModule,
	HeroModule,
	FeaturesModule,
	StepsModule,
	FaqModule,
	CtaModule,
	AdsModule,
	...DraggableOnlyModules
]);
