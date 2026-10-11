# 自定义页面

`routes` 让你给启动器**加一个自己的页面**，用户可以导航过去。

```ts
api.routes.add({
	path: '/plugins/my-plugin',
	component: MyPage,
})
```

需要 `route` 权限（低风险，自动授予）。

## `RouteDefinition`

```ts
{
	path: string // 必填，绝对路径，必须以 '/' 开头
	name?: string // 可选，路由名
	component: Component // 必填，Vue 组件
	sidebar?: boolean // 是否在左侧导航栏显示入口。默认 true
	title?: string // 导航栏图标下方的文字
	icon?: string // 导航栏图标，一段内联 SVG 字符串
}
```

| 字段 | 说明 |
|---|---|
| `path` | **必须以 `/` 开头**，且不能和启动器已有的路由冲突 |
| `component` | Vue 组件（SFC 默认导出，或 `defineComponent` 的结果） |
| `sidebar` | 是否在**左侧导航栏**显示入口。默认 `true` |
| `title` | 导航栏图标下方的文字，也是 tooltip。默认用 `path` |
| `icon` | 导航栏的图标，**一段内联 SVG 字符串**（不是文件路径） |

::: tip 让页面出现在左侧导航栏
带上 `title` 和 `icon`，页面就会在启动器左侧导航栏里有一个入口：

```ts
api.routes.add({
	path: '/plugins/my-plugin',
	title: '我的插件',
	icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ...>...</svg>',
	component: MyPage,
})
```

`sidebar: false` 则是「注册了路由，但不放导航入口」——适合只从卡片或按钮跳过去的页面。

用户可以在插件设置里把这几个页面**钉在导航栏**或收进抽屉，所以入口不一定一直显示。
:::

## 路径不要撞车

启动器自己占了很多路径。撞了会抛错：

```
Route path "/plugin/foo" is already taken. Launcher routes use reserved prefixes
like "/plugin/:id" (Modrinth project pages) — register yours under a distinct
path such as "/plugins/<your-id>".
```

::: danger 注意 `/plugin/` 和 `/plugins/` 的区别
- `/plugin/...` —— 启动器**保留**的（Modrinth 项目页等）
- `/plugins/...` —— **给你的**

一字之差。用 `/plugins/<你的id>` 这个前缀最安全。

官方的 hello-world 用 `/plugins/hello-world`，模板用 `/plugins/my-plugin`。
:::

推荐写法：**`/plugins/<你的插件 id>`**，用完整的 id 避免和其他插件撞。

## 导航过去

```ts
api.router.push('/plugins/my-plugin') // 压入历史
api.router.replace('/plugins/my-plugin') // 替换当前
```

`router` **不需要权限**——它只是移动用户，不能替用户做任何事。

### 高亮当前页

`api.router.currentPath` 是一个**响应式**的 `ComputedRef`，用来判断「用户现在是不是在我的页面」：

```ts
const isActive = computed(() => api.router.currentPath.value === '/plugins/my-plugin')
```

还有 `api.router.current()` 是**快照**（非响应式），只在你想读一次当前路径时用。

## 完整例子

```ts
import type { PluginHostApi } from '@celestial/plugin'
import MyPage from './MyPage.vue'

export async function activate(api: PluginHostApi): Promise<void> {
	const pagePath = '/plugins/my-plugin'

	api.routes.add({
		path: pagePath,
		name: 'my-plugin-page', // 可选
		component: MyPage,
	})

	// 侧边栏卡片点了跳过去
	api.slots.add('sidebar.top', {
		id: 'card',
		component: MyCard,
		props: {
			onOpen: () => api.router.push(pagePath),
		},
	})
}
```

页面组件和普通 Vue 组件一样：

```vue
<!-- MyPage.vue -->
<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
	<div class="p-6 flex flex-col gap-2">
		<h1 class="m-0 text-2xl font-semibold">我的页面</h1>
		<p class="m-0 text-secondary">点击 {{ count }} 次</p>
		<button class="w-fit" @click="count++">点我</button>
	</div>
</template>
```

## 用 `api.vue` 写渲染函数

不想引入 SFC 时：

```ts
api.routes.add({
	path: pagePath,
	component: {
		name: 'MyPluginPage',
		setup() {
			const { h, ref } = api.vue
			const count = ref(0)
			return () =>
				h('div', { class: 'p-6 flex flex-col gap-2' }, [
					h('h1', { class: 'm-0 text-2xl font-semibold' }, api.plugin.name),
					h('p', { class: 'm-0 text-secondary' }, `点击 ${count.value} 次`),
					h('button', { onClick: () => count.value++ }, '点我'),
				])
		},
	},
})
```

## 重复注册

同一个插件在**同一次会话里重新注册同一个路径**（比如热重载），启动器会先把旧的那条移除再注册，不会报错。

但**不同插件**注册同一个路径会抛错。

## 页面里的样式

页面渲染在启动器的布局里，所以：

- 启动器的 Tailwind 工具类可以直接用（`p-6`、`flex`、`text-secondary`……）。
- 启动器的 CSS 变量可以直接用（`var(--color-brand)` 等）。
- 想要自己的样式，用 `api.styles.add` 注入（需要 `style` 权限）。

## 返回按钮

启动器的顶栏有后退按钮，用户可以从你的页面退回去——你不需要自己做导航栏。

如果希望用户**从侧边栏导航到你的页面**，在侧边栏插槽放一个卡片（见[插槽](/plugin/slots)），点击时 `api.router.push`。

## 常见错误

| 现象 | 原因 |
|---|---|
| `A route needs an absolute path starting with "/"` | `path` 没有以 `/` 开头 |
| `Route path "..." is already taken` | 用了启动器保留的路径，换 `/plugins/<id>` |
| `cannot use routes: the "route" permission has not been granted` | manifest 里没声明 `route` |
| 页面打开是白的 | 组件抛错了，看日志 |
| `Route "..." needs a component` | 忘了传 `component` |

---

接下来：[样式](/plugin/styling)。
