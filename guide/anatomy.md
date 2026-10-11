# 项目结构与构建产物

这一页讲清楚一个插件仓库里每个文件是干什么的、构建出来的是什么、以及为什么。内容源和 UI 插件在这一点上差别很大。

## 内容源的结构

```
my-content-source/
├── manifest.json
├── src/
│   ├── index.ts          入口，导出 activate
│   └── ...               你自己的模块，随便拆
├── types/
│   └── content-source.d.ts   类型副本（从商店 SDK 复制）
├── vite.config.ts
├── tsconfig.json
├── package.json
└── .github/workflows/
    ├── release.yml
    └── sdk-drift.yml
```

### `src/` 里可以有多个文件

`index.ts` 只是入口，你可以自由拆分。官方的 CurseForge 源就把「标签翻译」「镜像」「加载器名映射」拆成了独立模块。启动器不关心你怎么组织源码——它只读构建出来的那一个 bundle。

### `types/content-source.d.ts` 是什么

它是一份**类型定义副本**。内容源的 SDK 不在 npm 上发布，所以：

- 权威版本在商店仓库的 `sdk/index.d.ts`
- 每个插件仓库在 `types/` 放一份**逐字节相同**的副本
- 副本只服务编辑器补全和 `tsc` 检查，**不进构建产物**

它靠 `declare module '@celestial/content-source'` 声明一个模块，所以你写 `import type { ... } from '@celestial/content-source'` 能解析到。

**副本会过期。** 商店那边更新了 SDK，你的副本不会自动跟着变。所以有 `sdk-drift.yml`：

```yaml
# .github/workflows/sdk-drift.yml
name: SDK 副本
on: [push, pull_request, workflow_dispatch]
jobs:
  sdk-drift:
    uses: Wemsur/Celestial-Plugin-Store/.github/workflows/check-sdk-drift.yml@main
```

它做的事：拉一次权威文件，和你的副本**逐字节 `diff`**，不一致就失败。手动同步：

```bash
curl -fsSL https://raw.githubusercontent.com/Wemsur/Celestial-Plugin-Store/main/sdk/index.d.ts \
  -o types/content-source.d.ts
```

### `vite.config.ts`

内容源的构建配置很短，因为它不需要 Vue：

```ts
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
	build: {
		target: 'chrome105',
		lib: {
			entry: join(projectRoot, 'src/index.ts'),
			formats: ['es'],
			fileName: () => 'index.js',
		},
		sourcemap: true,
		minify: false,
		emptyOutDir: true,
	},
})
```

几个关键点：

| 配置 | 为什么 |
|---|---|
| `target: 'chrome105'` | 启动器的 webview 是固定的 Chromium 版本，不需要为更老的浏览器降级 |
| `formats: ['es']` | 启动器用 `import()` 加载，只要 ES 模块 |
| `fileName: () => 'index.js'` | 固定文件名，manifest 的 `entry` 才能写死 |
| `minify: false` | **故意不压缩**。加载失败时要靠人读产物排查 |
| `sourcemap: true` | 报错堆栈能指回源码 |

::: tip 想压缩就改 `minify: true`
发布版可以打开压缩减小体积，但调试时记得关掉。官方的几个源都保持 `false`——这点体积换来的可调试性是值得的。
:::

## UI 插件的结构

```
my-plugin/
├── manifest.json
├── src/
│   ├── index.ts          入口
│   └── SidebarCard.vue   Vue 单文件组件
├── types/
│   └── celestial-plugin.d.ts   宿主 API 类型（也是副本，但来源是启动器仓库）
├── build/
│   └── celestial-vue.mjs       构建插件：改写 vue 导入
├── vite.config.ts
└── package.json
```

### `build/celestial-vue.mjs` 在干什么

这是 UI 插件和内容源最大的区别。UI 插件跑在启动器的页面里，**必须和启动器共用同一个 Vue 实例**。

如果插件自带打包一份 Vue，会产生两个问题：

1. 启动器渲染不了插件用另一个 Vue 创建的组件。
2. 两份 Vue 的响应式系统互不相通，`ref` 改了一个，另一个看不到。

所以模板的 `vite.config.ts` 加了一条别名：

```ts
import { celestialVueAlias } from './build/celestial-vue.mjs'

export default defineConfig({
	plugins: [vue()],
	resolve: {
		// 把每一个 vue 导入——包括 SFC 编译器自己生成的——都指向一个生成的
		// shim，那个 shim 从全局变量里取启动器的 Vue。
		alias: [celestialVueAlias(projectRoot)],
	},
	// ...
})
```

`celestialVueAlias` 会在构建时生成一个 shim 文件，里面是：

```js
// 大意
const vue = globalThis.__CELESTIAL_PLUGIN_VUE__
export const { h, ref, computed, watch, defineComponent, ... } = vue
export default vue
```

于是你写 `import { ref } from 'vue'`，实际拿到的是启动器的 `ref`。

### 构建后必须自查

```bash
grep -c 'from"vue"\|from '"'"'vue'"'"'' dist/index.js
```

结果必须是 **0**。应该只看到从 `globalThis.__CELESTIAL_PLUGIN_VUE__` 读取的代码。

### `types/celestial-plugin.d.ts` 从哪来

权威版本在启动器仓库的 `plugin-sdk/template/types/celestial-plugin.d.ts`。它声明的是 `declare module '@celestial/plugin'`。

::: warning 这份副本没有漂移检查
内容源有 `sdk-drift.yml` 工作流兜底，UI 插件目前**没有**。宿主 API 更新时，你得手动把这份文件同步过来。它会随启动器版本变化，注意启动器仓库的更新日志。
:::

## 构建产物

两种插件构建出来都是**同一个东西**：

```
dist/index.js      一个 ES 模块，可能带一个 dist/index.js.map
```

- **不打包 `node_modules`。** 你的依赖会被 Vite 内联进这一个文件（内容源没有运行期依赖，UI 插件只有 Vue，而 Vue 被别名替换掉了）。
- **没有单独的 CSS 文件。** UI 插件通过 `api.styles.add(css)` 注入样式，构建配置里也是 `lib` 模式，不会产出 `.css`。
- **不代码分割。** 插件是独立加载的，不需要按需加载。

## 装到磁盘上长什么样

| | 内容源 | UI 插件 |
|---|---|---|
| 目录 | `<数据目录>/content-sources/<id>/` | `<数据目录>/plugins/<id>/` |
| Windows 上的数据目录 | `%APPDATA%\CelestialLauncher\` | 同左 |
| 必须有的文件 | `manifest.json` + `entry` 指到的文件 | 同左 |
| 可选 | `icon` 声明的图标 | 同左 |

安装时（从商店装）启动器读的是**一个 zip**，里面必须包含：

```
manifest.json
dist/index.js
icon.png          ← 如果 manifest 声明了
```

**不要把 `src/`、`node_modules/`、`.github/` 打进去。** 带了也不会坏，但没必要——发布流程会自动帮你只打包需要的文件。

---

接下来：[装进启动器调试](/guide/local-install)。
