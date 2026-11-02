/**
 * 同页预览的样式隔离标记。值写在挂载根上，选择器只匹配它的后代。
 */
export const PREVIEW_STYLE_SCOPE_ATTR = 'data-playground-scope';

/** 直接调用编译器、没有挂载根时使用的稳定标记。 */
export const DEFAULT_PREVIEW_STYLE_SCOPE = 'docs-local-root';

const SCOPE_VALUE = /^[a-z0-9-]+$/iu;

export const isPreviewStyleScope = (value: string) => SCOPE_VALUE.test(value);

export const previewStyleScopeSelector = (scopeValue: string) => {
	if (!isPreviewStyleScope(scopeValue)) {
		throw new TypeError(`[Playground] 无效的样式隔离标记: ${scopeValue}`);
	}
	return `[${PREVIEW_STYLE_SCOPE_ATTR}="${scopeValue}"]`;
};

const scopedAttribute = (scopeValue: string) => `[data-v-${scopeValue.replace(/^data-v-/, '')}]`;

const skipString = (css: string, start: number) => {
	const quote = css[start];
	let index = start + 1;
	while (index < css.length) {
		if (css[index] === '\\') {
			index += 2;
			continue;
		}
		if (css[index] === quote) return index + 1;
		index += 1;
	}
	return css.length;
};

const containsToken = (value: string, token: string) => {
	let quote: string | null = null;
	let comment = false;
	for (let index = 0; index < value.length; index += 1) {
		const char = value[index];
		if (comment) {
			if (char === '*' && value[index + 1] === '/') {
				comment = false;
				index += 1;
			}
			continue;
		}
		if (quote) {
			if (char === '\\') {
				index += 1;
				continue;
			}
			if (char === quote) quote = null;
			continue;
		}
		if (char === '/' && value[index + 1] === '*') {
			comment = true;
			index += 1;
			continue;
		}
		if (char === '"' || char === '\'') {
			quote = char;
			continue;
		}
		if (value.startsWith(token, index)) return true;
	}
	return false;
};

const stripToken = (value: string, token: string) => {
	let quote: string | null = null;
	let comment = false;
	let result = '';
	for (let index = 0; index < value.length; index += 1) {
		const char = value[index];
		if (comment) {
			result += char;
			if (char === '*' && value[index + 1] === '/') {
				result += '/';
				index += 1;
				comment = false;
			}
			continue;
		}
		if (quote) {
			result += char;
			if (char === '\\') {
				if (value[index + 1] !== undefined) {
					result += value[index + 1];
					index += 1;
				}
				continue;
			}
			if (char === quote) quote = null;
			continue;
		}
		if (char === '/' && value[index + 1] === '*') {
			comment = true;
			result += '/*';
			index += 1;
			continue;
		}
		if (char === '"' || char === '\'') {
			quote = char;
			result += char;
			continue;
		}
		if (value.startsWith(token, index)) {
			index += token.length - 1;
			continue;
		}
		result += char;
	}
	return result;
};

const liftSelector = (selector: string, token: string, scopeSelector: string) => {
	if (!containsToken(selector, token)) return selector;
	const match = /^(\s*)([\s\S]*?)(\s*)$/u.exec(selector);
	const leading = match?.[1] ?? '';
	const trailing = match?.[3] ?? '';
	const bare = stripToken(match?.[2] ?? '', token).replace(/[ \t]{2,}/gu, ' ').trim();
	const body = bare ? `${scopeSelector} ${bare}` : scopeSelector;
	return `${leading}${body}${trailing}`;
};

const rewriteSelectors = (head: string, token: string, scopeSelector: string) => {
	if (!containsToken(head, token)) return head;
	const parts: string[] = [];
	let current = '';
	let paren = 0;
	let bracket = 0;
	let quote: string | null = null;
	let comment = false;
	for (let index = 0; index < head.length; index += 1) {
		const char = head[index];
		if (comment) {
			current += char;
			if (char === '*' && head[index + 1] === '/') {
				current += '/';
				index += 1;
				comment = false;
			}
			continue;
		}
		if (quote) {
			current += char;
			if (char === '\\') {
				if (head[index + 1] !== undefined) {
					current += head[index + 1];
					index += 1;
				}
				continue;
			}
			if (char === quote) quote = null;
			continue;
		}
		if (char === '/' && head[index + 1] === '*') {
			comment = true;
			current += '/*';
			index += 1;
			continue;
		}
		if (char === '"' || char === '\'') {
			quote = char;
			current += char;
			continue;
		}
		if (char === '(') paren += 1;
		else if (char === ')' && paren) paren -= 1;
		else if (char === '[') bracket += 1;
		else if (char === ']' && bracket) bracket -= 1;
		else if (char === ',' && paren === 0 && bracket === 0) {
			parts.push(liftSelector(current, token, scopeSelector));
			current = '';
			continue;
		}
		current += char;
	}
	parts.push(liftSelector(current, token, scopeSelector));
	return parts.join(',');
};

const splitHead = (prelude: string) => {
	let quote: string | null = null;
	let comment = false;
	let paren = 0;
	let bracket = 0;
	let lastSemicolon = -1;
	for (let index = 0; index < prelude.length; index += 1) {
		const char = prelude[index];
		if (comment) {
			if (char === '*' && prelude[index + 1] === '/') {
				comment = false;
				index += 1;
			}
			continue;
		}
		if (quote) {
			if (char === '\\') {
				index += 1;
				continue;
			}
			if (char === quote) quote = null;
			continue;
		}
		if (char === '/' && prelude[index + 1] === '*') {
			comment = true;
			index += 1;
			continue;
		}
		if (char === '"' || char === '\'') {
			quote = char;
			continue;
		}
		if (char === '(') paren += 1;
		else if (char === ')' && paren) paren -= 1;
		else if (char === '[') bracket += 1;
		else if (char === ']' && bracket) bracket -= 1;
		else if (char === ';' && paren === 0 && bracket === 0) lastSemicolon = index;
	}
	return {
		prefix: prelude.slice(0, lastSemicolon + 1),
		head: prelude.slice(lastSemicolon + 1)
	};
};

type BlockKind = 'at' | 'keyframes' | 'rule';

const classify = (head: string): 'empty' | BlockKind => {
	const trimmed = head.replace(/\/\*[\s\S]*?\*\//gu, '').trim();
	if (!trimmed) return 'empty';
	if (/^@(?:-\w+-)?keyframes\b/iu.test(trimmed)) return 'keyframes';
	if (trimmed.startsWith('@')) return 'at';
	return 'rule';
};

/**
 * 把 Vue scoped 打在目标元素上的属性，改成预览根的后代选择器。
 * 子组件内部节点没有这个属性，但都渲染在预览根里面。
 * @param css `compileStyle({ scoped: true })` 的结果。
 * @param scopeValue 挂载根 `data-playground-scope` 的值。
 * @returns 只在预览根内生效的 CSS。
 */
export const liftPreviewScope = (css: string, scopeValue: string) => {
	const scopeSelector = previewStyleScopeSelector(scopeValue);
	const token = scopedAttribute(scopeValue);
	if (!css.includes(token)) return css;

	const stack: BlockKind[] = [];
	let result = '';
	let prelude = '';
	let index = 0;
	while (index < css.length) {
		if (css.startsWith('/*', index)) {
			const end = css.indexOf('*/', index + 2);
			const next = end === -1 ? css.length : end + 2;
			prelude += css.slice(index, next);
			index = next;
			continue;
		}
		const char = css[index];
		if (char === '"' || char === '\'') {
			const next = skipString(css, index);
			prelude += css.slice(index, next);
			index = next;
			continue;
		}
		if (char === '{') {
			const { prefix, head } = splitHead(prelude);
			const kind = classify(head);
			const inKeyframes = stack.includes('keyframes');
			result += kind === 'rule' && !inKeyframes
				? prefix + rewriteSelectors(head, token, scopeSelector)
				: prelude;
			result += '{';
			stack.push(kind === 'keyframes' ? 'keyframes' : kind === 'rule' ? 'rule' : 'at');
			prelude = '';
			index += 1;
			continue;
		}
		if (char === '}') {
			result += `${prelude}}`;
			prelude = '';
			stack.pop();
			index += 1;
			continue;
		}
		prelude += char;
		index += 1;
	}
	return result + prelude;
};
