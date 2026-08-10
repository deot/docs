import { defineComponent, inject, provide } from 'vue';
import type { PropType } from 'vue';

interface VcStubOptions {
	message?: {
		success: (value: string) => void;
		error: (value: string) => void;
	};
	setScrollTop?: (value: number) => void;
}

const getInputValue = (event: Event) => (event.target as HTMLInputElement).value;

/**
 * 为 Client 单元测试构造 VC 组件的轻量渲染函数替身。
 * 使用 TSX 与 d-vc 的测试风格保持一致，并避免额外的模板编译路径
 * 掩盖属性、插槽或事件错误。
 * @param options 有状态组件替身向当前测试暴露的监听函数。
 * @returns 组件测试所使用的部分 \@deot/vc 模块。
 */
export const createVcStubs = (options: VcStubOptions = {}) => ({
	Message: options.message,
	Affix: defineComponent({
		props: {
			disabled: Boolean,
			placement: String,
			offset: Number
		},
		setup: (props, { expose, slots }) => {
			expose({ refresh: vi.fn() });
			return () => (
				<div
					class="affix"
					data-disabled={String(props.disabled)}
					data-offset={props.offset}
					data-placement={props.placement}
				>
					{slots.default?.({ active: !props.disabled })}
				</div>
			);
		}
	}),
	Button: defineComponent({
		props: {
			disabled: Boolean,
			type: String
		},
		setup: (props, { slots }) => () => (
			<button disabled={props.disabled} data-type={props.type}>{slots.default?.()}</button>
		)
	}),
	Input: defineComponent({
		props: { modelValue: [String, Number] },
		emits: ['update:modelValue', 'change', 'enter'],
		setup: (props, { emit }) => () => (
			<input
				value={props.modelValue}
				onInput={event => emit('update:modelValue', getInputValue(event))}
				onChange={event => emit('change', getInputValue(event))}
				onKeyup={event => event.key === 'Enter' && emit('enter')}
			/>
		)
	}),
	Select: defineComponent({
		props: {
			modelValue: [String, Number],
			data: { type: Array as PropType<Array<{ label: string; value: unknown }>>, default: () => [] }
		},
		emits: ['update:modelValue', 'change'],
		setup: (props, { emit }) => () => (
			<select
				value={props.modelValue}
				onChange={(event) => {
					const value = getInputValue(event);
					emit('update:modelValue', value);
					emit('change', value);
				}}
			>
				<option value="">All</option>
				{props.data.map(item => (
					<option value={String(item.value)}>{item.label}</option>
				))}
			</select>
		)
	}),
	DatePicker: defineComponent({
		props: { modelValue: String },
		emits: ['update:modelValue', 'change', 'ok'],
		setup: (props, { emit }) => () => (
			<input
				type="date"
				value={props.modelValue}
				onChange={(event) => {
					const value = getInputValue(event);
					emit('update:modelValue', value);
					emit('change', value);
				}}
			/>
		)
	}),
	InputNumber: defineComponent({
		props: { modelValue: Number },
		emits: ['update:modelValue', 'enter'],
		setup: (props, { emit }) => () => (
			<input
				type="number"
				value={props.modelValue}
				onInput={event => emit('update:modelValue', Number(getInputValue(event)))}
				onKeyup={event => event.key === 'Enter' && emit('enter')}
			/>
		)
	}),
	Pagination: defineComponent({
		props: {
			current: Number,
			count: Number,
			pageSize: Number,
			pageSizeOptions: {
				type: Array as PropType<number[]>,
				default: () => [10, 20, 50]
			}
		},
		emits: ['change', 'page-size-change'],
		setup: (props, { emit }) => () => (
			<div class="pagination">
				<span>{`${props.current}/${props.count}/${props.pageSize}`}</span>
				<button data-page="2" onClick={() => emit('change', 2)}>Page 2</button>
				{props.pageSizeOptions.map(size => (
					<button
						data-page-size={size}
						onClick={() => emit('page-size-change', String(size))}
					>
						{`${size} / page`}
					</button>
				))}
			</div>
		)
	}),
	Table: defineComponent({
		props: {
			data: { type: Array as PropType<any[]>, default: () => [] },
			loading: Boolean,
			affix: [Boolean, Array, Object]
		},
		setup: (props, { expose, slots }) => {
			expose({ refreshAffix: vi.fn() });
			provide('getTableRows', () => props.data);
			return () => (
				<div class="table" data-affix={JSON.stringify(props.affix)}>
					{props.data.map(item => item?.id).filter(value => value !== undefined).join(',')}
					{slots.default?.()}
					{slots.empty?.()}
					{slots.append?.()}
				</div>
			);
		}
	}),
	TableColumn: defineComponent({
		props: { label: String },
		setup: (props, { slots }) => {
			const getRows = inject<() => any[]>('getTableRows', () => []);
			return () => (
				<div class="column" data-column={props.label}>
					{getRows().map(row => <div>{slots.default?.({ row })}</div>)}
				</div>
			);
		}
	}),
	Popover: defineComponent({
		props: { disabled: Boolean },
		setup: (props, { slots }) => () => (
			<span class="popover" data-disabled={String(props.disabled)}>
				{slots.default?.()}
				<span class="popover-content">{slots.content?.()}</span>
			</span>
		)
	}),
	Checkbox: defineComponent({
		props: {
			modelValue: Boolean,
			label: String
		},
		emits: ['change'],
		setup: (props, { emit }) => () => (
			<button
				class="checkbox"
				data-column-toggle={props.label}
				onClick={() => emit('change', !props.modelValue)}
			>
				{props.label}
			</button>
		)
	}),
	Scroller: defineComponent({
		name: 'Scroller',
		props: { contentClass: String },
		setup: (props, { expose, slots }) => {
			expose({ setScrollTop: options.setScrollTop });
			return () => (
				<div class="test-scroller">
					<div class={props.contentClass}>{slots.default?.()}</div>
				</div>
			);
		}
	})
});
