/**
 * 多选会话。选中项只保留当前文档中仍然存在的节点 ID。
 */
export class SelectionSession {
	ids: string[] = [];

	get selectedId() {
		return this.ids[0] || null;
	}

	set(ids: readonly string[], exists: (id: string) => boolean) {
		this.ids = [...new Set(ids)].filter(id => Boolean(exists(id)));
	}

	select(id: string | null, additive = false) {
		if (!id) {
			this.ids = [];
			return;
		}
		if (additive) {
			this.ids = this.ids.includes(id)
				? this.ids.filter(value => value !== id)
				: [...this.ids, id];
		} else this.ids = [id];
	}

	clear() {
		this.ids = [];
	}
}
