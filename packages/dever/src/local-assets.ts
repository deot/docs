export const CLIENT_PREFIX = '/@deot/docs-client/';
export const LAUNCH_PREFIX = '/@deot/docs-launch/';

const LAUNCH_ASSET_PATTERN = new RegExp([
	String.raw`(?:https?:)?//[^/"'\x60\s<>]+(?:/[^/"'\x60\s<>?#]+)*/@deot/docs-launch`,
	String.raw`(?:@[^/"'\x60\s<>?#]+)?(?:/\+esm|/dist/index\.js)?(?=["'\x60\s<>?#]|$)`
].join(''), 'gu');
const clientPackage = String.raw`(?:https?:)?//[^/"'\x60\s<>]+(?:/[^/"'\x60\s<>?#]+)*/@deot/docs-client(?:@[^/"'\x60\s<>?#]+)?`;
const suffix = String.raw`((?:[?#][^"'\x60\s<>]*)?)(?=["'\x60\s<>]|$)`;

// HTML 与浏览器预览适配共用同一张映射表，保留 query/hash。
export const CLIENT_ASSET_REPLACEMENTS: [RegExp, string][] = [
	[new RegExp(`${clientPackage}(?:/dist/index\\.js|/\\+esm)${suffix}`, 'gu'), `${CLIENT_PREFIX}dist/index.js$1`],
	[new RegExp(`${clientPackage}/dist/index\\.style\\.css${suffix}`, 'gu'), `${CLIENT_PREFIX}dist/index.style.css$1`],
	[/https?:\/\/esm\.unpkg\.com\/@deot\/docs-client(?:@[^/"'\x60\s<>?#]+)?(?=["'\x60\s<>?#]|$)/gu, `${CLIENT_PREFIX}dist/index.js`]
];

export const rewriteLaunchUrls = (source: string, entry: string) => source.replace(LAUNCH_ASSET_PATTERN, entry);

export const rewriteClientAssets = (source: string) => CLIENT_ASSET_REPLACEMENTS.reduce(
	(result, [pattern, replacement]) => result.replace(pattern, replacement),
	source
);
