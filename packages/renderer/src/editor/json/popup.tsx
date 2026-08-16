/** @jsxImportSource vue */
import {
	computed,
	defineComponent,
	h,
	ref
} from 'vue';
import type { PropType } from 'vue';
import {
	Button,
	Input,
	InputNumber,
	Modal,
	Scroller,
	SortList,
	Switch,
	Textarea
} from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import { createRendererModuleCatalog } from '../../catalog';
import { prepareRendererDocument } from '../../document';
import type {
	RendererDocument,
	RendererModuleContext,
	RendererModuleSource
} from '../../types';
import { cloneRendererValue, isRendererRecord, validateRendererDocument } from '../../validate';
import { createRendererId } from '../../utils/id';
import { jsonFieldPolicy } from './policy';
import type { JsonKind, JsonPath } from './policy';

interface JsonTreeRow {
	value: string;
	label: string;
	keyValue: string | number | null;
	path: JsonPath;
	parentPath: JsonPath;
	parentKind: JsonKind | null;
	kind: JsonKind;
	raw: unknown;
	policy: ReturnType<typeof jsonFieldPolicy>;
	children?: JsonTreeRow[];
}

const kindOf = (value: unknown): JsonKind => {
	if (value === null) return 'null';
	if (Array.isArray(value)) return 'array';
	if (typeof value === 'number') return 'number';
	if (typeof value === 'boolean') return 'boolean';
	if (typeof value === 'string') return 'string';
	return 'object';
};
const pointerSegment = (value: string | number) => String(value).replace(/~/gu, '~0').replace(/\//gu, '~1');
const pointer = (path: JsonPath) => path.length ? `/${path.map(pointerSegment).join('/')}` : '/';
const safeObject = (entries: Array<[string, unknown]>) => Object.fromEntries(entries);

export default defineComponent({
	name: 'DocsRendererJsonPopup',
	props: {
		document: { type: Object as PropType<RendererDocument>, required: true },
		modules: { type: Array as PropType<readonly RendererModuleSource[]>, required: true },
		context: { type: Object as PropType<RendererModuleContext>, required: true }
	},
	emits: ['portal-fulfilled', 'portal-rejected'],
	setup(props, { emit }) {
		const { t } = useLocale(computed(() => props.context.locale));
		const draft = ref<unknown>(cloneRendererValue(props.document));
		const source = ref(JSON.stringify(draft.value, null, '\t'));
		const view = ref<'tree' | 'source'>('tree');
		const error = ref('');
		const active = ref(true);
		const catalog = createRendererModuleCatalog(props.modules);

		const getValue = (path: JsonPath) => path.reduce<unknown>((value, segment) => (
			value && typeof value === 'object' ? (value as Record<string | number, unknown>)[segment] : undefined
		), draft.value);
		const replaceAt = (value: unknown, path: JsonPath, next: unknown): unknown => {
			if (!path.length) return next;
			const [head, ...rest] = path;
			if (Array.isArray(value)) {
				const result = [...value];
				result[Number(head)] = replaceAt(result[Number(head)], rest, next);
				return result;
			}
			const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
			return safeObject(Object.keys(record).map(key => [
				key,
				key === String(head) ? replaceAt(record[key], rest, next) : record[key]
			]));
		};
		const updateAt = (path: JsonPath, value: unknown) => {
			const current = getValue(path);
			if (jsonFieldPolicy(path, kindOf(current)).valueLocked) return;
			draft.value = replaceAt(draft.value, path, value);
			source.value = JSON.stringify(draft.value, null, '\t');
			error.value = '';
		};
		const removeAt = (path: JsonPath) => {
			if (!path.length) return;
			const current = getValue(path);
			if (!jsonFieldPolicy(path, kindOf(current)).removable) return;
			const parentPath = path.slice(0, -1);
			const key = path.at(-1)!;
			const parent = getValue(parentPath);
			if (!Array.isArray(parent)) return;
			updateAt(parentPath, parent.filter((_item, index) => index !== Number(key)));
		};
		const createBlockStub = () => {
			const layout = getValue(['layout']);
			const mode = layout && typeof layout === 'object' && !Array.isArray(layout)
				? String((layout as Record<string, unknown>).mode || '')
				: '';
			const module = { type: 'text', version: 1, props: { text: '' } };
			if (mode === 'draggable') {
				return {
					id: createRendererId(),
					module,
					placement: { x: 40, y: 40, width: 280, height: 160, rotate: 0, zIndex: 1 }
				};
			}
			return {
				id: createRendererId(),
				module,
				appearance: {
					marginTop: 0,
					marginBottom: 0,
					paddingTop: 0,
					paddingBottom: 0,
					paddingLeft: 0,
					paddingRight: 0
				}
			};
		};
		const createArrayItem = (row: JsonTreeRow) => {
			const items = Array.isArray(row.raw) ? row.raw : [];
			if (row.policy.pattern === 'blocks' && !items.length) return createBlockStub();
			const last = items.at(-1);
			if (typeof last === 'undefined') return '';
			if (last === null || typeof last !== 'object') return last;
			const cloned = cloneRendererValue(last);
			if (isRendererRecord(cloned) && typeof cloned.id === 'string') cloned.id = createRendererId();
			return cloned;
		};
		const addChild = (row: JsonTreeRow) => {
			if (!row.policy.canAddChild || row.kind !== 'array') return;
			updateAt(row.path, [...(row.raw as unknown[]), createArrayItem(row)]);
		};
		const buildRows = (value: unknown, path: JsonPath = [], parentKind: JsonKind | null = null): JsonTreeRow => {
			const kind = kindOf(value);
			const keyValue = path.length ? path.at(-1)! : null;
			const row: JsonTreeRow = {
				value: pointer(path),
				label: keyValue === null ? '$' : String(keyValue),
				keyValue,
				path,
				parentPath: path.slice(0, -1),
				parentKind,
				kind,
				raw: value,
				policy: jsonFieldPolicy(path, kind)
			};
			if (Array.isArray(value)) {
				row.children = value.map((item, index) => buildRows(item, [...path, index], 'array'));
			} else if (value && typeof value === 'object') {
				row.children = Object.keys(value).map(
					key => buildRows((value as Record<string, unknown>)[key], [...path, key], 'object')
				);
			}
			return row;
		};
		const rows = computed(() => [buildRows(draft.value)]);
		const draftIssues = computed(() => {
			if (view.value === 'source') {
				try {
					return validateRendererDocument(JSON.parse(source.value)).issues;
				} catch {
					return [];
				}
			}
			return validateRendererDocument(draft.value).issues;
		});
		const errorText = computed(() => {
			if (error.value) return error.value;
			return draftIssues.value.map(issue => `${issue.path}: ${issue.message}`).join('\n');
		});
		const stop = (handler: () => void) => (event: Event) => {
			event.stopPropagation();
			handler();
		};
		const renderValue = (row: JsonTreeRow) => {
			if (row.kind === 'string') return h(Input, {
				'modelValue': String(row.raw),
				'disabled': row.policy.valueLocked,
				'title': row.policy.valueLocked ? t('renderer.json.valueLocked') : undefined,
				'onUpdate:modelValue': (value: string) => updateAt(row.path, value),
				'onClick': (event: Event) => event.stopPropagation()
			});
			if (row.kind === 'number') return h(InputNumber, {
				'modelValue': Number(row.raw),
				'precision': 2,
				'disabled': row.policy.valueLocked,
				'title': row.policy.valueLocked ? t('renderer.json.valueLocked') : undefined,
				'onUpdate:modelValue': (value: number) => {
					updateAt(row.path, Number(Number(value).toFixed(2)));
				},
				'onClick': (event: Event) => event.stopPropagation()
			});
			if (row.kind === 'boolean') return h(Switch, {
				'modelValue': Boolean(row.raw),
				'onUpdate:modelValue': (value: boolean) => updateAt(row.path, value),
				'onClick': (event: Event) => event.stopPropagation()
			});
			return h('span', { class: 'docs-renderer-json__summary' }, row.kind === 'null' ? 'null' : `${row.kind}(${row.children?.length || 0})`);
		};
		const renderNode = (row: JsonTreeRow) => h('div', {
			'class': ['docs-renderer-json__fields', {
				'is-locked': row.policy.valueLocked || !row.path.length
			}],
			'data-json-key': row.keyValue === null ? '$' : String(row.keyValue),
			'data-json-kind': row.kind,
			'onClick': (event: Event) => event.stopPropagation()
		}, [
			h('span', { class: 'docs-renderer-json__key' }, [
				row.parentKind === 'array'
					? h('span', { class: 'docs-renderer-json__drag-handle' }, '⋮⋮')
					: null,
				row.keyValue === null ? '$' : row.parentKind === 'array' ? `[${row.keyValue}]` : String(row.keyValue)
			]),
			h('span', { class: 'docs-renderer-json__kind', title: t('renderer.json.kindLocked') }, row.kind),
			renderValue(row),
			h('div', { class: 'docs-renderer-json__ops' }, [
				row.policy.canAddChild
					? h('button', {
							'type': 'button',
							'class': 'docs-renderer-json__add',
							'title': t('renderer.editor.addItem'),
							'aria-label': t('renderer.editor.addItem'),
							'onClick': stop(() => addChild(row))
						})
					: h('span', { class: 'docs-renderer-json__op-slot' }),
				row.policy.removable
					? h('button', {
							'type': 'button',
							'class': 'docs-renderer-json__remove',
							'title': t('renderer.editor.removeItem'),
							'aria-label': t('renderer.editor.removeItem'),
							'onClick': stop(() => removeAt(row.path))
						})
					: h('span', { class: 'docs-renderer-json__op-slot' })
			])
		]);
		/**
		 * 数组子项由 SortList 统一排序；树形层级只负责表达结构。
		 * @param row 当前 JSON 节点。
		 * @param isLast 是否为同级最后一项，用来截断树形竖线。
		 * @returns 当前节点及其递归子树。
		 */
		const renderTree = (row: JsonTreeRow, isLast = true): ReturnType<typeof h> => {
			const children = row.children || [];
			const childContent = row.kind === 'array' && children.length
				? h(SortList, {
						modelValue: children,
						primaryKey: 'value',
						mask: false,
						class: 'docs-renderer-json__sort-list',
						onChange: (value: JsonTreeRow[]) => updateAt(row.path, value.map(item => item.raw))
					}, {
						default: ({ row: child }: { row: JsonTreeRow }) => renderTree(
							child,
							child.value === children.at(-1)?.value
						)
					})
				: children.map((child, index) => renderTree(child, index === children.length - 1));
			return h('div', {
				key: row.value,
				class: ['docs-renderer-json__node', {
					'is-root': !row.path.length,
					'is-last': isLast
				}]
			}, [
				renderNode(row),
				children.length ? h('div', { class: 'docs-renderer-json__children' }, childContent) : null
			]);
		};
		const switchView = (next: 'tree' | 'source') => {
			if (next === 'tree') {
				try {
					draft.value = JSON.parse(source.value);
					error.value = '';
				} catch (reason) {
					error.value = reason instanceof Error ? reason.message : String(reason);
					return;
				}
			} else source.value = JSON.stringify(draft.value, null, '\t');
			view.value = next;
		};
		const handleApply = async () => {
			try {
				const value = view.value === 'source' ? JSON.parse(source.value) : draft.value;
				const result = await prepareRendererDocument(value, catalog, props.context);
				if (!result.valid || !result.document) {
					error.value = result.issues.map(issue => `${issue.path}: ${issue.message}`).join('\n');
					return;
				}
				emit('portal-fulfilled', result.document);
			} catch (reason) {
				error.value = reason instanceof Error ? reason.message : String(reason);
			}
		};
		return () => h(Modal, {
			'modelValue': active.value,
			'onUpdate:modelValue': (value: boolean) => active.value = value,
			'title': t('renderer.json.title'),
			'width': 1280,
			'height': 760,
			'maskClosable': false,
			'contentClass': 'docs-renderer-json-modal__content',
			'wrapperClass': 'docs-renderer-json-modal',
			'onCancel': () => emit('portal-rejected')
		}, {
			default: () => h('div', {
				'class': 'docs-renderer-json docs-renderer-json-modal__body',
				'data-vc-theme': props.context.theme
			}, [
				h('div', { class: 'docs-renderer-json-modal__switcher' }, [
					h(Button, {
						type: view.value === 'tree' ? 'primary' : 'default',
						onClick: () => switchView('tree')
					}, () => t('renderer.json.tree')),
					h(Button, {
						type: view.value === 'source' ? 'primary' : 'default',
						onClick: () => switchView('source')
					}, () => t('renderer.json.source'))
				]),
				h(Scroller, {
					height: '100%',
					native: false,
					showBar: true
				}, {
					default: () => h('div', { class: 'docs-renderer-json-modal__workspace' }, [
						view.value === 'tree'
							? h('div', { class: 'docs-renderer-json__tree' }, rows.value.map(row => renderTree(row)))
							: h(Textarea, {
									'class': 'docs-renderer-json__source',
									'modelValue': source.value,
									'rows': 30,
									'spellcheck': false,
									'onUpdate:modelValue': (value: string) => source.value = value
								}),
						errorText.value ? h('pre', { class: 'docs-renderer-json-modal__error' }, errorText.value) : null
					])
				})
			]),
			footer: () => [
				h(Button, { onClick: () => emit('portal-rejected') }, () => t('renderer.json.cancel')),
				h(Button, { type: 'primary', onClick: handleApply }, () => t('renderer.json.apply'))
			]
		});
	}
});
