// @vitest-environment jsdom

import { mount } from '@vue/test-utils';
import { Tag } from '../src/components/tag';

describe('Tag', () => {
	it('uses the status palette without rendering an icon', () => {
		const wrapper = mount(() => (<Tag type="pending">pending</Tag>));

		expect(wrapper.attributes('data-type')).toBe('pending');
		expect(wrapper.attributes('style')).toContain('var(--vc-color-warning)');
		expect(wrapper.text()).toBe('pending');
		expect(wrapper.find('i, svg').exists()).toBe(false);
	});

	it('derives type and label from value mappings and supports custom colors', () => {
		const wrapper = mount(() => (
			<Tag
				value="ready"
				options={{ success: ['ready'] }}
				label={{ success: 'Ready' }}
				color={{ success: ['#000000', '#ffffff'] }}
				ellipsis={false}
			/>
		));

		expect(wrapper.attributes('data-type')).toBe('success');
		expect(wrapper.text()).toBe('Ready');
		expect(wrapper.attributes('style')).toContain('background-color: rgb(0, 0, 0)');
		expect(wrapper.find('.docs-tag__label--ellipsis').exists()).toBe(false);
	});
});
