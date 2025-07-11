# @deot/dev-cli

包管理命令行

## `ddc <cmd>`

- `dev`
- `build`
- `link`
- `test`
- `add`
- `release`: [与本仓库相同](../../README.md)

## 其他

暂时不支持全局引入，一些配置项，如`tsconfig.json`, `api-extractor.json`, `jest.config.cjs` 这些依赖项目本身


## 默认的目录参考（配置后期再考虑）

#### Monorepo

```
Monorepo
├─ .husky
├─ packages
│    ├─ index
│    │    ├─ __tests__
│    │    ├─ src
│    │    ├─ api-extractor.json
│    │    └─ package.json
│    ├─ shared
│    │    ├─ __tests__
│    │    ├─ src
│    │    ├─ api-extractor.json
│    │    └─ package.json
│    └─ shims.d.ts
├─ .eslintignore
├─ .eslintrc.cjs
├─ .lintstagedrc.json
├─ .npmrc
├─ jest.config.js
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
├─ tsconfig.json
└─ package.json
```

#### Single Repo

```
Single Repo
├─ .husky
├─ __tests__
├─ src
├─ .eslintignore
├─ .eslintrc.cjs
├─ .npmrc
├─ jest.config.js
├─ shims.d.ts
├─ api-extractor.json
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
├─ tsconfig.json
├─ yarn.lock
└─ package.json
```

