export type PagingFilterValue = string | number | Date | unknown[] | null | undefined;
export type PagingAffixOption = boolean | Record<string, unknown>;
export type PagingAffix = boolean | [PagingAffixOption, PagingAffixOption];

export interface PagingFilterOption {
	label: string;
	value: string | number;
	disabled?: boolean;
}

interface PagingFilterModuleBase {
	label?: string;
	options?: Record<string, unknown>;
}

export interface PagingCommonFilterModule extends PagingFilterModuleBase {
	type: 'input' | 'select' | 'date-picker';
	field: string;
	placeholder?: string;
	data?: PagingFilterOption[];
	defaultValue?: PagingFilterValue;
}

export interface PagingRangeFilterModule extends PagingFilterModuleBase {
	type: 'range';
	field: [string, string];
	placeholder?: string | [string, string];
	defaultValue?: [PagingFilterValue, PagingFilterValue];
	separator?: string;
}

export type PagingFilterModule = PagingCommonFilterModule | PagingRangeFilterModule;
export type PagingKeywords = Record<string, PagingFilterValue>;

export interface PagingPageResult<T> {
	records: T[];
	current?: number;
	pages?: number;
	total: number;
}

export interface PagingListResult<T> {
	list: T[];
	page: {
		current?: number;
		total?: number;
		count: number;
	};
}

export type PagingLoadResult<T> = T[]
	| PagingPageResult<T>
	| PagingListResult<T>
	| { data: T[] | PagingPageResult<T> | PagingListResult<T> };

export type PagingLoadData<T> = (
	page: number,
	pageSize: number,
	keywords: PagingKeywords
) => PagingLoadResult<T> | Promise<PagingLoadResult<T>>;

export interface PagingExpose<T> {
	getData: () => T[];
	load: () => Promise<void>;
	reset: (toFirst?: boolean) => Promise<void>;
	refreshAffix: () => void;
}
