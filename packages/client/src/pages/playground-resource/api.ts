import { PlaygroundResource } from '../../modules/playground-resource';
import type { PlaygroundResourceRow } from '../../modules/playground-resource';
import { getDocsNamespace } from '../../utils/resolver';
import { getDocsConfig } from '../../utils/runtime';

const getNamespace = () => getDocsNamespace(getDocsConfig());

export const getPage = async () => (
	PlaygroundResource.listPage(getDocsConfig())
);

export const save = async (
	row: Pick<PlaygroundResourceRow, 'kind' | 'alias' | 'defaultUrl'>,
	url: string
) => (
	PlaygroundResource.save(getNamespace(), row.alias, url, row.kind, row.defaultUrl)
);

export const reset = async (row: PlaygroundResourceRow) => (
	PlaygroundResource.reset(getNamespace(), row.alias, row.kind, row.defaultUrl)
);

export const clear = async () => (
	PlaygroundResource.clear(getNamespace())
);

export const prefetch = async (rows: PlaygroundResourceRow[]) => (
	PlaygroundResource.prefetch(getNamespace(), rows)
);

export const retry = async (row: PlaygroundResourceRow) => (
	PlaygroundResource.retry(getNamespace(), row)
);

export const subscribeStatus = (listener: () => void) => (
	PlaygroundResource.subscribeStatus(listener)
);
