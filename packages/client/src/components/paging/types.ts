export type PagingFilterValue = string | number | Date | unknown[] | null | undefined;
/**
 * 传给 `@deot/vc` Affix 的原始配置。`true` 用默认吸顶/吸底；对象会展开到组件 props。
 */
export type PagingAffixOption = boolean | Record<string, unknown>;
/**
 * 表格与底部分页条的吸顶/吸底。
 * 元组为 `[表格, 底部分页]`；单个布尔值同时作用于两处。
 */
export type PagingAffix = boolean | [PagingAffixOption, PagingAffixOption];

export interface PagingFilterOption {
	label: string;
	value: string | number;
	disabled?: boolean;
}

interface PagingFilterModuleBase {
	label?: string;
	/**
	 * 透传到具体筛选控件的额外 props，例如 select 的 `multiple`。
	 */
	options?: Record<string, unknown>;
}

export interface PagingCommonFilterModule extends PagingFilterModuleBase {
	type: 'input' | 'select' | 'date-picker';
	/**
	 * 写入 `keywords` 的字段名。
	 */
	field: string;
	placeholder?: string;
	data?: PagingFilterOption[];
	defaultValue?: PagingFilterValue;
}

export interface PagingRangeFilterModule extends PagingFilterModuleBase {
	type: 'range';
	/**
	 * 区间起止对应的两个 `keywords` 字段名。
	 */
	field: [string, string];
	placeholder?: string | [string, string];
	defaultValue?: [PagingFilterValue, PagingFilterValue];
	separator?: string;
}

export type PagingFilterModule = PagingCommonFilterModule | PagingRangeFilterModule;
/**
 * 当前筛选值，键为 filter `field`。
 */
export type PagingKeywords = Record<string, PagingFilterValue>;

export interface PagingPageResult<T> {
	records: T[];
	/**
	 * 服务端当前页码。缺省时沿用组件内部页码。
	 */
	current?: number;
	/**
	 * 总页数。组件分页条目前只读 `total`，该字段仅兼容接口。
	 */
	pages?: number;
	/**
	 * 记录总数，不是页数。
	 */
	total: number;
}

export interface PagingListResult<T> {
	list: T[];
	page: {
		/**
		 * 服务端当前页码。缺省时沿用组件内部页码。
		 */
		current?: number;
		/**
		 * 总页数。组件目前不读取该字段。
		 */
		total?: number;
		/**
		 * 记录总数。注意不是页数，对应 `PagingPageResult.total`。
		 */
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
	/**
	 * 重新加载。`toFirst` 为 true 时先回到第 1 页。
	 */
	reset: (toFirst?: boolean) => Promise<void>;
	refreshAffix: () => void;
}
