export interface HistoryEntry {
	label: string;
	mergeKey?: string;
	createdAt: number;
	undo: () => void;
	redo: () => void;
}

/**
 * 文档命令历史栈。连续字段输入通过 mergeKey 合并，避免每个字符复制整篇文档。
 */
export class HistoryStack {
	private entries: HistoryEntry[] = [];
	private cursor = 0;
	private limit: number;

	constructor(limit = 100) {
		this.limit = Math.max(1, limit);
	}

	get canUndo() {
		return this.cursor > 0;
	}

	get canRedo() {
		return this.cursor < this.entries.length;
	}

	clear() {
		this.entries = [];
		this.cursor = 0;
	}

	push(entry: HistoryEntry) {
		this.entries.splice(this.cursor);
		const previous = this.entries.at(-1);
		if (
			entry.mergeKey
			&& previous?.mergeKey === entry.mergeKey
			&& entry.createdAt - previous.createdAt <= 600
		) {
			previous.redo = entry.redo;
			previous.createdAt = entry.createdAt;
			this.cursor = this.entries.length;
			return;
		}
		this.entries.push(entry);
		if (this.entries.length > this.limit) this.entries.shift();
		this.cursor = this.entries.length;
	}

	execute(entry: Omit<HistoryEntry, 'createdAt'>) {
		const value = { ...entry, createdAt: Date.now() };
		value.redo();
		this.push(value);
	}

	undo() {
		if (!this.canUndo) return;
		this.cursor -= 1;
		this.entries[this.cursor].undo();
	}

	redo() {
		if (!this.canRedo) return;
		this.entries[this.cursor].redo();
		this.cursor += 1;
	}
}
