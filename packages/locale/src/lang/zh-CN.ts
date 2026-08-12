import type { Language } from '../types';

const zhCN = {
	name: 'zh-CN',
	client: {
		common: {
			close: '关闭',
			invalidSidebar: '侧边栏数据无效',
			loading: '加载中…',
			poweredBy: '由 @deot/docs 提供支持',
			resourceRequestFailed: '资源请求失败',
			yes: '是'
		},
		header: {
			brand: '@deot/docs',
			database: '打开资源数据库',
			language: '切换语言',
			switchToDark: '切换至深色主题',
			switchToLight: '切换至浅色主题'
		},
		search: {
			trigger: '搜索文档',
			untitled: '未命名文档',
			dialogLabel: '搜索文档',
			placeholder: '搜索文档',
			clearQuery: '清空',
			close: '关闭搜索',
			searching: '搜索中…',
			documentation: '文档',
			noResults: '未找到结果。',
			noCachedDocuments: '暂无已缓存文档。',
			recent: '最近访问',
			noRecent: '暂无搜索历史。',
			pin: '收藏历史',
			unpin: '取消收藏',
			remove: '删除历史',
			navigateHint: '切换',
			selectHint: '选择',
			closeHint: '关闭',
			historyLoadFailed: '无法加载搜索历史。',
			queryFailed: '无法搜索已缓存文档。',
			historyUpdateFailed: '无法更新搜索历史。',
			historyRemoveFailed: '无法删除搜索历史。'
		},
		database: {
			title: 'IndexedDB 资源',
			back: '返回',
			home: '回到首页',
			records: '{count} 条记录',
			cache: '缓存 {size}',
			columns: '列',
			refresh: '刷新',
			updateAll: '全部更新',
			prefetch: '预加载',
			clear: '清空',
			prune: '清理垃圾',
			url: 'URL',
			source: '来源',
			contentStatus: '内容状态',
			requestStatus: '请求状态',
			namespace: '命名空间',
			language: '语言',
			type: '类型',
			hash: 'Hash',
			content: '内容',
			updated: '更新时间',
			checked: '检查时间',
			accessed: '访问时间',
			previous: '历史版本',
			actions: '操作',
			update: '更新',
			delete: '删除',
			loadFailed: '加载失败',
			operationFailed: '操作失败',
			refreshed: '已刷新',
			reloadFailed: '更新失败',
			updatedSource: '{source} 已更新',
			deletedSource: '{source} 已删除',
			updatedAll: '已全部更新',
			clearedAll: '已全部清空',
			prefetchSummary: '预加载：{fulfilled} 个成功，{rejected} 个失败',
			prefetched: '已预加载 {total} 个资源',
			prefetchFailed: '预加载失败',
			pruned: '已清理 {count} 个资源',
			pruneFailed: '垃圾清理失败'
		},
		paging: {
			search: '搜索',
			reset: '重置',
			enter: '请输入',
			select: '请选择',
			pickDate: '选择日期',
			min: '最小值',
			max: '最大值'
		}
	},
	markdown: {
		indicator: {
			label: '文档指示器',
			untitled: '未命名章节',
			document: '文档'
		}
	},
	playground: {
		common: {
			copy: '复制',
			copyCode: '复制代码',
			copyCurrentFile: '复制当前文件',
			close: '关闭'
		},
		runtime: {
			preview: '运行时预览',
			files: '文件预览',
			auto: '自适应',
			viewport: '视口：{value}',
			viewportMenu: '运行时视口',
			editFiles: '编辑文件'
		},
		files: {
			entry: '入口'
		},
		editor: {
			entry: '入口文件',
			entryCannotDelete: '入口文件不能删除',
			confirmDelete: '确认删除 {filename}？',
			deleteFile: '删除文件',
			createFile: '新建文件',
			setEntry: '设为入口'
		},
		validation: {
			entryMissing: '入口文件 {filename} 不存在',
			filenameRequired: '请输入文件名',
			filenameRelative: '文件名必须是相对 POSIX 路径',
			filenameSegments: '文件路径不能包含空段、. 或 ..',
			fileTypeUnsupported: '不支持该文件类型',
			filenameExists: '文件名已存在'
		}
	}
} as const satisfies Language;

export default zhCN;
