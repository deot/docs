export const ADS_LAYOUTS = ['tile', 'scroll'] as const;
export const ADS_STYLES = ['banner', 'card', 'poster', 'notice'] as const;

export type RendererAdsLayout = typeof ADS_LAYOUTS[number];
export type RendererAdsStyle = typeof ADS_STYLES[number];

export interface RendererAdsItem {
	src: string;
	href: string;
	title: string;
	alt: string;
}

const UNSAFE_HREF = /^(?:data|javascript|vbscript):/iu;

export const isUnsafeHref = (value: string) => UNSAFE_HREF.test(value.trim());
