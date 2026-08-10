<template>
	<footer class="docs-footer">Powered by @deot/docs</footer>
</template>
<style lang="scss">
@use '../../styles/bem' as *;

@include block(docs-footer) {
	display: grid;
	padding: 100px 48px 48px;
	font-family: "PingFang SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
	font-size: 14px;
	color: #999;
	text-align: center;
	background: #141313;
	place-items: start center;
}
</style>
