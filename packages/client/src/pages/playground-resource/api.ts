import { Resource } from '../../modules/resource';
import type { PlaygroundResourceRow } from '../../modules/resource/playground';
import { getDocsNamespace } from '../../utils/resolver';
import { getDocsConfig } from '../../utils/runtime';

const getNamespace = () => getDocsNamespace(getDocsConfig());

export const getPage = async () => (
	Resource.playground.listPage(getDocsConfig())
);

export const save = async (
	row: Pick<PlaygroundResourceRow, 'kind' | 'alias' | 'defaultUrl'>,
	url: string
) => (
	Resource.playground.save(getNamespace(), row.alias, url, row.kind, row.defaultUrl)
);

export const reset = async (row: PlaygroundResourceRow) => (
	Resource.playground.reset(getNamespace(), row.alias, row.kind, row.defaultUrl)
);

export const clear = async () => (
	Resource.playground.clear(getNamespace())
);

export const prefetch = async (rows: PlaygroundResourceRow[]) => (
	Resource.playground.prefetch(getNamespace(), rows)
);

export const retry = async (row: PlaygroundResourceRow) => (
	Resource.playground.retry(getNamespace(), row)
);

export const subscribeStatus = (listener: () => void) => (
	Resource.playground.subscribeStatus(listener)
);
