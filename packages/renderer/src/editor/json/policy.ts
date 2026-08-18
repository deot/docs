export type JsonPath = Array<string | number>;
export type JsonKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface JsonFieldPolicy {
	/**
	 * 把数组下标收成星号后的协议路径，供策略表匹配。
	 */
	pattern: string;
	/**
	 * 协议键名不可改。数组下标不是键名。
	 */
	keyLocked: boolean;
	/**
	 * 只有数组元素可删，对象字段保持协议形状。
	 */
	removable: boolean;
	/**
	 * 值类型由协议决定，不可改。
	 */
	kindLocked: boolean;
	/**
	 * 值本身不可改，例如 schemaVersion 与 layout.mode。
	 */
	valueLocked: boolean;
	/**
	 * 只有数组可增项。
	 */
	canAddChild: boolean;
}

/**
 * 把 JSON 路径收成协议模式：数组下标一律写成星号。
 * @param path 从文档根到当前节点的路径。
 * @returns 例如 blocks 下某模块的 type 路径。
 */
export const jsonPathPattern = (path: JsonPath) => path.map(segment => (
	typeof segment === 'number' ? '*' : String(segment)
)).join('/');

const VALUE_LOCKED = new Set([
	'schemaVersion',
	'layout/mode'
]);

/**
 * 页面 JSON 树策略：键名和类型从一开始就按协议锁定。
 * 树形编辑只改内容值；增删只发生在数组上。
 * @param path 当前节点路径。
 * @param kind 当前值类型。
 * @returns 键、值、类型和增删权限。
 */
export const jsonFieldPolicy = (path: JsonPath, kind: JsonKind): JsonFieldPolicy => {
	const pattern = jsonPathPattern(path);
	const arrayItem = Boolean(path.length) && typeof path.at(-1) === 'number';
	return {
		pattern,
		keyLocked: !arrayItem,
		removable: arrayItem,
		kindLocked: true,
		valueLocked: VALUE_LOCKED.has(pattern),
		canAddChild: kind === 'array'
	};
};
