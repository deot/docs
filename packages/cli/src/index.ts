import { InvalidArgumentError, program, Option } from 'commander';
import type { Command } from 'commander';
import { createRequire } from 'node:module';

import * as Dever from '@deot/docs-dever';
import type { CheckOptions, DeverOptions } from '@deot/docs-dever';

const require = createRequire(import.meta.url);

const defaultOptions: Option[] = [
	// workspace 选项示例：new Option('--workspace <string>', 'Select Workspace', 'clients'),
	new Option('--dry-run [boolean]', 'Dry Run').argParser((value) => {
		if (value === 'true') return true;
		if (value === 'false') return false;
		throw new InvalidArgumentError('Expected true or false');
	}),
	new Option('--custom <string>', 'Any Custom Info')
];

// 在绑定执行函数前，为每个命令追加相同的传输层选项。
const addOptions = <T extends DeverOptions>(ctx: Command, action: (options: T) => Promise<void>) => {
	defaultOptions.forEach(i => ctx.addOption(i));
	ctx.action(action);
};

program
	.version(require('../package').version);

// 使用指令参数 如 doc *;
program
	.usage('<cmd>');

// doc dev 开发命令。
addOptions(
	program
		.command('dev')
		.option('--workspace <string>', 'Select Workspace')
		.option('--package-name <string>', 'Select PackageName')
		.description('development mode'),
	Dever.run
);

// doc build 构建命令。
addOptions(
	program
		.command('build')
		.option('--workspace <string>', 'Select Workspace')
		.option('--out-dir <string>', 'Select Build OutDir')
		.option('--package-name <string>', 'Select PackageName')
		.description('production mode'),
	options => Dever.run({ ...options, build: true })
);

// doc preview 预览命令。
addOptions(
	program
		.command('preview')
		.option('--workspace <string>', 'Select Workspace')
		.option('--host <string>', 'Select Host')
		.option('--port <number>', 'Select Port', value => Number(value))
		.option('--package-name <string>', 'Select PackageName')
		.description('preview workspace in production mode'),
	options => Dever.run({ ...options, preview: true })
);

const parsePositive = (value: string) => {
	const number = Number(value);
	if (!Number.isFinite(number) || number < 0) throw new InvalidArgumentError('Expected a non-negative number');
	return number;
};

// doc check 冒烟检查命令。
addOptions<DeverOptions & CheckOptions>(
	program
		.command('check')
		.option('--workspace <string>', 'Select Workspace')
		.option('--package-name <string>', 'Select PackageName')
		.addOption(new Option('--mode <mode>', 'declared: use each example\'s own local setting; both: run local and iframe')
			.choices(['declared', 'local', 'iframe', 'both'])
			.default('declared'))
		.option('--include <pattern>', 'Only check routes or sources matching the pattern (* wildcards)')
		.option('--timeout <ms>', 'Max time to wait for each example to mount', parsePositive, 30000)
		.option('--settle <ms>', 'Time to keep collecting async errors after mount', parsePositive, 500)
		.addOption(new Option('--reporter <type>', 'Report format').choices(['text', 'json']).default('text'))
		.option('--url <url>', 'Check a running site instead of starting a dev server')
		.option('--strict', 'Fail on config warnings too')
		.description('mount every playground in a headless browser and report errors'),
	Dever.check
);

const main = async () => {
	try {
		await program.parseAsync(process.argv);
		if (!program.args.length) program.help();
	} catch (reason) {
		process.exitCode = 1;
		console.error(reason instanceof Error ? reason.message : reason);
	}
};

void main();
