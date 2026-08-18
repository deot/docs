export const ADS_LAYOUTS = ['tile', 'scroll'] as const;
export const ADS_STYLES = ['banner', 'card', 'poster', 'notice'] as const;

export type RendererAdsLayout = typeof ADS_LAYOUTS[number];
export type RendererAdsStyle = typeof ADS_STYLES[number];

export interface RendererAdsItem {
	/**
	 * 广告图地址。
	 */
	src: string;
	/**
	 * 点击跳转目标。
	 */
	href: string;
	title: string;
	alt: string;
}
