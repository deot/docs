import { InvalidArgumentError, program, Option } from 'commander';
import type { Command } from 'commander';
import { createRequire } from 'node:module';

import * as Dever from '@deot/docs-dever';

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
const addOptions = (ctx: Command, action: any) => {
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
	(options: any) => {
		options.build = true;
		return Dever.run(options);
	}
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
	(options: any) => {
		options.preview = true;
		return Dever.run(options);
	}
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
