import { Parallel, Task } from '@deot/helper-fp';

type ScheduledRequest = (() => Promise<unknown>) & { priority: number };

export type ScheduledResult<T> = Promise<T> & {
	/** 仅当任务仍在共享队列等待时提升优先级。 */
	setPriority: (priority: number) => void;
};

/** 所有 Gateway 请求共用的、支持优先级的并发边界。 */
export class RequestScheduler {
	private queue: ScheduledRequest[] = [];

	private parallel: Parallel | null = null;

	constructor(private concurrency: number) {}

	setConcurrency(value: number) {
		this.concurrency = Math.max(1, value);
		this.parallel?.setConcurrency(this.concurrency);
	}

	schedule<T>(run: () => Promise<T>, priority = 0) {
		let task!: ScheduledRequest;
		const promise = new Promise<T>((resolve, reject) => {
			task = Object.assign(
				async () => {
					try {
						resolve(await run());
					} catch (error) {
						reject(error);
					}
				},
				{ priority }
			);
			this.queue.push(task);
			// Parallel 通过 pop() 取数组任务，因此最高优先级需要排在末尾。
			this.queue.sort((a, b) => a.priority - b.priority);
			this.start();
		});
		return Object.assign(promise, {
			setPriority: (nextPriority: number) => {
				if (!this.queue.includes(task) || nextPriority <= task.priority) return;
				task.priority = nextPriority;
				// Parallel 通过 pop() 消费任务，因此等待任务提升优先级后，
				// 必须在下一个并发槽位释放前重新移动到队尾。
				this.queue.sort((a, b) => a.priority - b.priority);
			}
		}) as ScheduledResult<T>;
	}

	private start() {
		if (!this.parallel) {
			const parallel = new Parallel(this.queue as any, this.concurrency, { skipError: true });
			this.parallel = parallel;
			void this.run(parallel);
		}
		this.parallel.setConcurrency(this.concurrency);
	}

	private async run(parallel: Parallel) {
		try {
			await parallel.start();
		} catch {
			// 每个已调度 promise 都会单独收到对应的 rejection。
		} finally {
			if (this.parallel === parallel) this.parallel = null;
			if (this.queue.length) this.start();
		}
	}
}

export const toTask = <T>(fn: () => Promise<T>) => {
	const task = Task.of(undefined).map(fn);
	task.start();
	return task;
};
