<template>
	<Modal
		v-model="active"
		:title="t('client.playgroundResource.editTitle')"
		:width="560"
		:mask-closable="true"
		class="docs-playground-resource-source-editor"
		@ok="handleConfirm"
		@cancel="handleClose"
		@close="handleClose"
	>
		<div class="docs-playground-resource-source-editor__meta">
			<p>
				<span>{{ t('client.playgroundResource.kind') }}</span>
				<span
					class="docs-playground-resource__kind"
					:class="{ 'is-style': row.kind === 'style' }"
				>
					{{ kindLabel }}
				</span>
			</p>
			<p>
				<span>{{ t('client.playgroundResource.alias') }}</span>
				<code>{{ row.alias }}</code>
			</p>
			<p>
				<span>{{ t('client.playgroundResource.defaultUrl') }}</span>
				<code
					class="docs-playground-resource__ellipsis"
					:title="row.defaultUrl || '-'"
				>{{ row.defaultUrl || '-' }}</code>
			</p>
		</div>
		<label class="docs-playground-resource-source-editor__label">
			{{ t('client.playgroundResource.currentUrl') }}
		</label>
		<Textarea
			v-model="draft"
			:rows="4"
			:placeholder="t('client.playgroundResource.urlPlaceholder')"
		/>
	</Modal>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue';
import { Modal, Textarea } from '@deot/vc';
import { useLocale } from '@deot/docs-locale';
import {
	normalizePlaygroundResourceUrl,
	type PlaygroundResourceRow
} from '../../../modules/playground-resource';

const props = defineProps<{
	row: PlaygroundResourceRow;
	onConfirm?: (url: string) => void | Promise<void>;
}>();
const emit = defineEmits<{ 'portal-fulfilled': [] }>();
const { t } = useLocale();
const active = ref(true);
const draft = ref(props.row.currentUrl || '');
let closed = false;

const kindLabel = computed(() => (
	props.row.kind === 'style'
		? t('client.playgroundResource.kindStyle')
		: t('client.playgroundResource.kindImport')
));

const handleClose = () => {
	if (closed) return;
	closed = true;
	emit('portal-fulfilled');
};

const handleConfirm = async () => {
	const url = normalizePlaygroundResourceUrl(draft.value);
	if (!url) return;
	await props.onConfirm?.(url);
	handleClose();
};
</script>
<style lang="scss">
@use '../../../styles/bem' as *;

@include block(docs-playground-resource-source-editor) {
	@include element(meta) {
		display: grid;
		margin-bottom: 12px;
		gap: 8px;

		p {
			display: grid;
			margin: 0;
			grid-template-columns: 88px minmax(0, 1fr);
			gap: 8px;
			align-items: start;
			color: varfix(foreground-color-mute);
		}

		.docs-playground-resource__kind {
			justify-self: start;
			width: max-content;
		}

		code {
			overflow: hidden;
			font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
			font-size: 12px;
			color: varfix(foreground-color);
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	@include element(label) {
		display: block;
		margin-bottom: 8px;
		color: varfix(foreground-color-mute);
	}
}
</style>
