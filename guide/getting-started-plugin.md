# 15 分钟：第一个 UI 插件

这一页从空文件夹开始，写出一个**能装进启动器、往侧边栏放一张卡片、并注册一个自己的页面**的 UI 插件。

## 前提

和内容源一样：**Node.js 20+** 和 **pnpm**。

::: warning 模板必须复制到仓库外面
官方模板在启动器仓库的 `plugin-sdk/template/`。**不要留在仓库里构建**——父级的 pnpm workspace 会接管它，模板自己的 `node_modules` 建不出来，`vite` 命令也就找不到。

要留在仓库内构建的话，必须用 `pnpm install --ignore-workspace`。
:::

## 第一步：建目录

```bash
cp -r /path/to/CelestialLauncher/plugin-sdk/template ~/my-plugin
cd ~/my-plugin
pnpm install
pnpm build
```

结构：

```
my-plugin/
├── manifest.json              插件清单：id、权限
├── src/
│   ├── index.ts               入口，导出 activate(api)
│   └── SidebarCard.vue        Vue 单文件组件
├── types/
│   └── celestial-plugin.d.ts  宿主 API 类型定义
├── build/
│   └── celestial-vue.mjs      构建插件：把 vue 导入指向启动器实例
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 第二步：写 manifest.json

```json
{
	"id": "com.example.my-plugin",
	"name": "My Plugin",
	"description": "一个示例插件：侧边栏卡片 + 一个自己的页面。",
	"version": "1.0.0",
	"author": "你的名字",
	"homepage": "https://example.com",
	"type": "ui",
	"api_version": 1,
	"entry": "dist/index.js",
	"permissions": ["style", "storage", "slot:sidebar.top", "route"]
}
```

和内容源 manifest 的差异：

| 字段 | 说明 |
|---|---|
| `type` | **必须有**，UI 插件填 `"ui"`（内容源没有这个字段） |
| `permissions` | 权限数组，每项 `kind` 或 `kind:scope`（内容源是 `capabilities` 对象） |
| `id` | 建议用**反向域名**（`com.example.my-plugin`），但不强制 |

`permissions` 里的四项都是**低风险**，装上即生效，不需要用户批准：

| 权限 | 作用 |
|---|---|
| `style` | 注入 CSS |
| `storage` | 读写插件自己的数据目录 |
| `slot:sidebar.top` | 往侧边栏顶部放 UI |
| `route` | 注册一个页面 |

::: danger `slot` 和 `route` 这类权限必须带 scope
`"slot"` 单独写会被 manifest 校验拒绝，必须是 `"slot:sidebar.top"`。反过来说，`"style"`、`"storage"` 这类**不能**带 scope——写成 `"style:global"` 也会被拒绝。

完整的 kind / scope / 风险对照见[权限总表](/reference/permissions)。
:::

## 第三步：写实现

模板的 `src/index.ts` 已经是一个可用的最小插件。逐段看它在做什么：

```ts
// src/index.ts
import type { PluginHostApi } from '@celestial/plugin'

import SidebarCard from './SidebarCard.vue'

export async function activate(api: PluginHostApi): Promise<void> {
	// 1. 注入样式。style 是低风险权限，装上就能用。
	api.styles.add(`
		.my-plugin-card {
			display: flex;
			flex-direction: column;
			gap: 4px;
			margin: 8px 16px;
			padding: 12px;
			border-radius: 10px;
			background: var(--color-brand);
			color: var(--color-accent-contrast);
			cursor: pointer;
		}
	`)

	// 2. 读写自己的存储。storage 也是低风险。
	const opens = Number((await api.storage.get('opens')) ?? '0') + 1
	await api.storage.set('opens', String(opens))

	const pagePath = '/plugins/my-plugin'

	// 3. 注册一个页面。route 是低风险。
	api.routes.add({
		path: pagePath,
		component: {
			name: 'MyPluginPage',
			setup() {
				const { h } = api.vue
				return () =>
					h('div', { class: 'p-6 flex flex-col gap-2' }, [
						h('h1', { class: 'm-0 text-2xl font-semibold' }, api.plugin.name),
						h('p', { class: 'm-0 text-secondary' }, `插件已启动 ${opens} 次。`),
					])
			},
		},
	})

	// 4. 往侧边栏顶部放一张卡片，点了跳到自己那个页面。
	api.slots.add('sidebar.top', {
		id: 'card',
		component: SidebarCard,
		props: {
			pluginName: api.plugin.name,
			version: api.plugin.version,
			opens,
			onOpen: () => api.router.push(pagePath),
		},
	})

	api.log('activated; page at', pagePath)
}
```

### 四个要点

**`activate` 是入口，只调用一次。** 启动器在应用渲染完之后调用它。可以是 async。

**`api.plugin` 是你的身份。** `api.plugin.id` / `.name` / `.version` 来自 manifest，只读。

**`api.vue` 是启动器的 Vue。** 这里的 `h`、`ref`、`computed` 都是启动器实例上的，不是你自己打包的 Vue——这一点非常关键，见[Vue 与组件](/plugin/vue)。

**`api.slots.add` 的 `id` 要在同一个插槽里唯一。** 重复注册同一个 id 会抛错。

## 第四步：构建

```bash
pnpm build
```

产物是 `dist/index.js`。

**构建后自查一遍**，确认没有把 Vue 打进去：

```bash
grep -c 'from"vue"\|from '"'"'vue'"'"'' dist/index.js
```

这个数字应该是 **0**。插件里所有 `vue` 导入都被 `build/celestial-vue.mjs` 这个插件改写成了从 `globalThis.__CELESTIAL_PLUGIN_VUE__` 读取。如果产物里有裸的 `import 'vue'`，插件加载时会失败——启动器渲染不了第二个 Vue 实例。

## 第五步：装进启动器

```
%APPDATA%\CelestialLauncher\plugins\com.example.my-plugin\
├── manifest.json          ← 必须在这一层
├── dist\
│   └── index.js
└── src\ build\ ...        ← 源码放着无妨，启动器只读 manifest 和 entry
```

::: danger 判断插件根的方法只有一个
**哪个文件夹里有 `manifest.json`，那个文件夹就是插件根。**

常见的错误是把 `dist/` 当成了插件根，于是变成：

```
plugins\com.example.my-plugin\dist\manifest.json    ← ❌ 启动器扫不到
```

manifest 的 `entry` 是**相对插件根**解析的，所以 `"entry": "dist/index.js"` 配上面正确的目录结构才对。
:::

**文件夹名必须等于 manifest 的 `id`。** 重启启动器，在「设置 → 插件」里应该能看到它，并可以在界面上批准权限。

侧边栏顶部会出现那张卡片，点一下跳到你注册的页面。

## 第六步：调试

**开启热重载**：设置页里有一个「Hot reload」开关（默认开）。开着的时候，改代码 → `pnpm build` → 设置页里点一下重新加载，**不需要重启启动器**。

**看日志**：`api.log(...)` 的输出带 `[plugin:<id>]` 前缀，在启动器的日志窗口里。

常见的头几个错误：

| 现象 | 原因 |
|---|---|
| 设置页里没有这个插件 | 文件夹名 ≠ `id`，或者 `manifest.json` 不在插件根那一层 |
| 显示「启动失败」 | `activate` 抛错了。看错误文本——它会指出是哪一行 |
| `Plugin "x" cannot use slots: the "slot:sidebar.top" permission has not been granted` | manifest 里没声明这项权限，或者声明了但用户在设置页没批准 |
| 卡片是空白/不显示 | 组件抛错了。热重载后看日志 |
| 插件整个不动 | `dist/index.js` 里有裸的 `import 'vue'`（见第四步的自查） |

## 下一步

- [manifest 与权限](/plugin/manifest-permissions) —— 权限模型、风险分级、怎么优雅降级
- [Vue 与组件](/plugin/vue) —— 为什么共用同一个 Vue 实例，`.vue` 文件怎么用
- [插槽](/plugin/slots) —— 所有能放 UI 的位置
- [订阅事件](/plugin/events) —— 对实例变化、安装进度做出反应
- [发布与上架](/guide/publishing) —— 让别人也能装上

想照着真实插件学？[实例拆解](/cookbook/)里有「一言」（最小 UI 插件）和「陶瓦联机」（sidecar + LAN）的拆解。
