# 插槽

插槽（slot）是启动器界面里**预留给你放 UI 的位置**。往插槽里加一个组件，它就会出现在启动器界面的对应位置。

## 用法

```ts
api.slots.add('sidebar.top', {
	id: 'card', // 在同一个插槽里唯一
	component: MyCard, // Vue 组件
	props: { /* 传给组件的 props */ },
})
```

需要对应的权限：`slot:<插槽名>`，比如 `slot:sidebar.top`。

## 全部插槽

| 插槽 id | 位置 |
|---|---|
| `topbar.left` | 顶栏左侧 |
| `topbar.center` | 顶栏中间 |
| `topbar.right` | 顶栏右侧 |
| `navbar.bottom` | 左侧导航栏底部 |
| `sidebar.top` | 侧边栏顶部 |
| `sidebar.after-jumpback` | 侧边栏「返回」之后 |
| `sidebar.after-account` | 侧边栏账号区之后 |
| `sidebar.bottom` | 侧边栏底部 |
| `home.top` | 主页顶部 |
| `home.middle` | 主页中部 |
| `home.bottom` | 主页底部 |

::: tip 插槽是「加东西」，不是「改布局」
插槽里的内容**追加**到那个位置，不会替换掉启动器原有的东西。想替换或重排结构，那是[接管结构区域](/plugin/regions)（高风险）。

大多数插件用插槽就够了。
:::

## `SlotDefinition`

```ts
{
	id: string // 必填，在同一个插槽里唯一
	component?: Component // Vue 组件（推荐）
	props?: Record<string, unknown> // 传给组件的 props
	render?: () => Node | null | void // 或者返回一个 DOM 节点
}
```

**`component` 和 `render` 二选一。** 优先用 `component`——它受 Vue 的响应式管理，启动器状态变了会重新渲染。`render` 返回的 DOM 是死的。

## `id` 的规则

`id` 必须在**同一个插槽**里唯一。同一个插件往同一个插槽加两个 id 相同的定义会抛错：

```
Slot "sidebar.top:card" is already taken by this plugin.
```

不同插件之间不会冲突——启动器按插件隔离命名空间。

## 组件的 props

`props` 直接传给组件。以 `on` 开头的是事件：

```ts
api.slots.add('sidebar.top', {
	id: 'card',
	component: SidebarCard,
	props: {
		title: '我的卡片',
		count: 3,
		onOpen: () => api.router.push('/plugins/my-plugin'), // 事件
	},
})
```

```vue
<!-- SidebarCard.vue -->
<script setup lang="ts">
defineProps<{ title: string; count: number }>()
const emit = defineEmits<{ open: [] }>()
</script>

<template>
	<div @click="emit('open')">{{ title }} ({{ count }})</div>
</template>
```

## 响应式：让卡片跟着启动器状态变

插槽组件里可以用 `api.vue` 的 `ref` / `computed`，它们和启动器共享响应式系统。

官方 hello-world 示例的做法——一张卡片显示实例数量，实例变化时自动更新：

```ts
export async function activate(api: PluginHostApi) {
	const { h, ref } = api.vue

	const instanceCount = ref<number | null>(null)

	async function refresh() {
		try {
			const instances = await api.hostApi.call('instance.list')
			instanceCount.value = Array.isArray(instances) ? instances.length : 0
		} catch {
			instanceCount.value = null // 未授权
		}
	}

	await refresh()

	// 实例变化时刷新（需要 event:instance 权限）
	api.events.on('instance', () => void refresh())

	api.slots.add('sidebar.top', {
		id: 'card',
		component: {
			name: 'InstanceCard',
			setup() {
				return () =>
					h('div', { class: 'p-3' }, [
						h('span', null, '实例'),
						h('span', null, instanceCount.value === null ? '未授权' : String(instanceCount.value)),
					])
			},
		},
	})
}
```

`instanceCount` 是共享的 `ref`——事件处理器改它，卡片会重新渲染。

## 用样式

插槽里的组件**没有自动的样式**。你有两种方式：

**方式一：`api.styles.add` 注入 CSS**（需要 `style` 权限）

```ts
api.styles.add(`
	.my-plugin-card {
		padding: 12px;
		border-radius: 10px;
		background: var(--color-brand);
		color: var(--color-accent-contrast);
	}
`)
```

**方式二：用启动器已有的 Tailwind 工具类**

插槽组件渲染在启动器的页面里，所以启动器的 CSS 对它生效：

```ts
h('div', { class: 'p-6 flex flex-col gap-2 text-secondary' }, [...])
```

::: tip 用启动器的 CSS 变量
启动器的主题变量（`--color-brand`、`--color-surface-2`、`--color-text-primary` 等）在你注入的 CSS 里可以直接用，这样你的界面会跟着用户的主题走：

```css
.my-card {
	background: var(--color-surface-3);
	color: var(--color-text-primary);
	border: 1px solid var(--color-divider);
}
```

详见[样式](/plugin/styling)。
:::

## 一个完整例子

```ts
import type { PluginHostApi } from '@celestial/plugin'
import MyCard from './MyCard.vue'

export async function activate(api: PluginHostApi): Promise<void> {
	api.styles.add(`
		.my-plugin-card {
			margin: 8px 16px;
			padding: 12px;
			border-radius: 10px;
			background: var(--color-brand);
			color: var(--color-accent-contrast);
			cursor: pointer;
		}
	`)

	const pagePath = '/plugins/my-plugin'

	api.slots.add('sidebar.top', {
		id: 'card',
		component: MyCard,
		props: {
			pluginName: api.plugin.name,
			version: api.plugin.version,
			onOpen: () => api.router.push(pagePath),
		},
	})
}
```

## 常见错误

| 现象 | 原因 |
|---|---|
| `cannot use slots: the "slot:sidebar.top" permission has not been granted` | manifest 里没声明 `slot:sidebar.top`，或者用户没批准 |
| `Slot "..." is already taken by this plugin` | 同一个插槽里用了重复的 `id` |
| 卡片不显示 | 插槽 id 拼错了（比如 `sidebar.top` 写成 `sidebar-top`） |
| 卡片样式不生效 | 没用 `api.styles.add` 注入，也没用启动器的工具类 |
| 卡片内容不更新 | 用了 `render` 返回 DOM，或者组件自己打包了 Vue |

---

接下来：[自定义页面](/plugin/routes)。
