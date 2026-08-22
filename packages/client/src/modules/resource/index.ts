import { Gateway } from '../gateway';
import { ResourcePlanner } from './plan';
import { PlaygroundResourceRuntime } from './playground';
import { IdlePrefetchScheduler } from './prefetch';

/**
 * 统一组装 Client 的资源网关与上层资源能力。
 */
class ResourceManager {
	readonly gateway = Gateway;
	readonly plan = new ResourcePlanner(this.gateway);
	readonly prefetch = new IdlePrefetchScheduler(this.gateway, this.plan);
	readonly playground = new PlaygroundResourceRuntime();
}

/**
 * Client 内所有资源调用方共用的统一实例。
 */
export const Resource = new ResourceManager();
