import {
	collectPlaygroundDefaultsWarnings,
	collectPlaygroundWarnings,
	suggestPlaygroundKey
} from '../src/playground-warnings';

describe('playground warnings', () => {
	it('flags unknown keys with a suggestion', () => {
		expect(suggestPlaygroundKey('previewInsets')).toBe('previewInset');
		expect(suggestPlaygroundKey('Mobile')).toBe('mobile');
		expect(suggestPlaygroundKey('completelyUnrelated')).toBe('');
		expect(collectPlaygroundWarnings({ previewInsets: 8, foo: 1 })).toEqual([
			'未知配置 previewInsets，是否想写 previewInset？',
			'未知配置 foo，该键会被忽略'
		]);
		expect(collectPlaygroundWarnings({ mobileDefaults: {} })).toEqual([
			'mobileDefaults 只能写在站点配置 components.playground 里，块内会被忽略'
		]);
		expect(collectPlaygroundWarnings({ title: 'ok', views: ['runtime'], view: 'runtime' })).toEqual([]);
	});

	it('flags keys the mobile split ignores', () => {
		expect(collectPlaygroundWarnings({
			mobile: true,
			views: ['runtime'],
			expandable: true,
			previewScroller: false,
			viewport: 'auto',
			viewportOptions: ['auto', 375]
		})).toEqual([
			'mobile 下 views 不生效，始终分栏显示代码和预览',
			'mobile 下 expandable 不生效，分栏高度固定',
			'mobile 下预览始终使用 Scroller，previewScroller: false 不生效',
			'mobile 下 viewport: \'auto\' 等同 375px 宽的预览列',
			'mobile 下 viewportOptions 的 \'auto\' 等同 375px 宽的预览列'
		]);
		expect(collectPlaygroundWarnings({ mobile: true, styleless: true, views: ['runtime'] }))
			.toEqual(['styleless 下 mobile 不生效']);
		expect(collectPlaygroundWarnings({ views: ['runtime'], expandable: true })).toEqual([]);
	});

	it('checks site defaults', () => {
		expect(collectPlaygroundDefaultsWarnings({
			views: ['runtime', 'files'],
			title: 'x',
			previewInsets: 1,
			mobileDefaults: { previewInset: [12, 0], mobile: true, previewVariable: [] }
		})).toEqual([
			'components.playground.title 是单个示例的字段，站点默认值里会被忽略',
			'components.playground: 未知配置 previewInsets，是否想写 previewInset？',
			'components.playground.mobileDefaults.mobile 不生效',
			'components.playground.mobileDefaults: 未知配置 previewVariable，是否想写 previewVariables？'
		]);
		expect(collectPlaygroundDefaultsWarnings({ mobileDefaults: [] })).toEqual([
			'components.playground.mobileDefaults 必须是对象'
		]);
		expect(collectPlaygroundDefaultsWarnings({ local: false, overlay: { setup() {} } })).toEqual([]);
		expect(collectPlaygroundDefaultsWarnings({ overlay: {} })).toEqual([
			'components.playground.overlay 必须是带 setup 函数的对象'
		]);
		expect(collectPlaygroundWarnings({ overlay: {} })).toEqual([
			'overlay 只能写在站点配置 components.playground 里，块内会被忽略'
		]);
	});
});
