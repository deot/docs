/** iframe 包装成功后挂在 `html` 上，供样式与 auto-height 识别。 */
export const PREVIEW_SCROLL_HTML_CLASS = 'docs-playground-preview-scroll';
/** Scroller 内容节点 class，auto-height 优先测量该节点。 */
export const PREVIEW_SCROLL_CONTENT_CLASS = 'docs-playground-preview-scroll__content';

/** 重评时先清掉 html class，避免 `await import` 期间仍套用 `height:100%`。 */
export const PREVIEW_SCROLL_RESET_CODE = (
	`document.documentElement.classList.remove("${PREVIEW_SCROLL_HTML_CLASS}");`
);

/** 动态探测 `@deot/vc`；失败时为空对象，不阻断 DocsLink / 预览挂载。 */
export const PREVIEW_SCROLLER_IMPORT_CODE = 'const __docsVc=await import("@deot/vc").catch(()=>({}))';

/**
 * Vue 的 `mount` 闭包的是 `createApp(root)` 时的根组件，改 `app._component` 不会生效。
 * 因此劫持 `app.mount`：等全部 useCode 注册完后，再 `createApp` 包一层 Scroller。
 * 前导分号避免接在 `app.component(...)` 后被 ASI 解析成调用返回值。
 */
export const PREVIEW_SCROLLER_USE_CODE = [
	';(()=>{',
	PREVIEW_SCROLL_RESET_CODE,
	'const __DocsScroller=__docsVc&&__docsVc.Scroller;',
	'if(!__DocsScroller)return;',
	'const UserApp=app._component;',
	'app.mount=(container,...rest)=>{',
	'const next=_createApp({',
	'name:"DocsPreviewRoot",',
	'setup(){return()=>__docsH(__DocsScroller,{',
	'height:"100%",',
	'native:false,',
	'autoResize:true,',
	'showBar:true,',
	`contentClass:"${PREVIEW_SCROLL_CONTENT_CLASS}"`,
	'},{default:()=>__docsH(UserApp)})}',
	'});',
	'next.config.errorHandler=app.config.errorHandler;',
	'if(app._context&&next._context){',
	'if(app._context.components)Object.assign(next._context.components,app._context.components);',
	'if(app._context.directives)Object.assign(next._context.directives,app._context.directives);',
	'}',
	'window.__app__=next;',
	`document.documentElement.classList.add("${PREVIEW_SCROLL_HTML_CLASS}");`,
	'return next.mount(container,...rest)',
	'}',
	'})()'
].join('');

export const PREVIEW_SCROLLER_STYLE = [
	`html.${PREVIEW_SCROLL_HTML_CLASS},`,
	`html.${PREVIEW_SCROLL_HTML_CLASS} body,`,
	`html.${PREVIEW_SCROLL_HTML_CLASS} #app{`,
	'height:100%;min-height:100%;margin:0;overflow:hidden',
	'}',
	// Scroller 的 height 写在 wrapper 上；根节点需先有明确高度，百分比才能约束滚动。
	`html.${PREVIEW_SCROLL_HTML_CLASS} #app>.vc-scroller,`,
	`html.${PREVIEW_SCROLL_HTML_CLASS} #app>.vc-scroller>.vc-scroller__wrapper{`,
	'height:100%;max-height:100%;box-sizing:border-box',
	'}'
].join('');
