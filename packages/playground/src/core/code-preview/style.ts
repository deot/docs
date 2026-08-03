import githubHighlightStyle from './github.css?inline';
import codePreviewStyle from './code-preview.scss?inline';

export const CODE_PREVIEW_STYLE_ID = 'docs-code-preview-style';
const styleText = `${githubHighlightStyle}\n${codePreviewStyle}`;

export const ensureCodePreviewStyle = () => {
	if (typeof document === 'undefined') return;
	let style = document.getElementById(CODE_PREVIEW_STYLE_ID);
	if (!style) {
		style = document.createElement('style');
		style.id = CODE_PREVIEW_STYLE_ID;
		document.head.appendChild(style);
	}
	if (style.textContent !== styleText) style.textContent = styleText;
};
