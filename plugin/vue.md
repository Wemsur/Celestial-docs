# Vue 与组件

UI 插件运行在启动器的页面里，和启动器**共用同一个 Vue 实例**。这一页讲为什么，以及这对你写代码意味着什么。

## 为什么必须共用一个实例

启动器本身就是 Vue 3 写的。你的插件组件最终要挂进启动器的组件树里。如果插件自带打包一份 Vue：

1. 启动器**渲染不了**用另一个 Vue 创建的 vnode。
2. 两份 Vue 的响应式系统互不相通——你的 `ref` 改了，启动器看不到；启动器的状态变了，你的 `computed` 不重算。

所以插件里所有 `vue` 导入，最终都必须指向**启动器的那一份**。

## 它是怎么做到的

模板的 `build/celestial-vue.mjs` 在构建时生成一个 shim 文件：

```js
// build/.generated/vue-shim.js （自动生成，别提交）
const runtime = globalThis['__CELESTIAL_PLUGIN_VUE__']
if (!runtime) {
	throw new Error('Celestial: the launcher did not expose its Vue. This plugin must run inside Celestial Launcher.')
}
export default runtime
export const h = runtime['h']
export const ref = runtime['ref']
export const computed = runtime['computed']
export const watch = runtime['watch']
// ...启动器 Vue 上的每一个具名导出
```

启动器在加载插件前，把自己的 Vue 挂到 `globalThis.__CELESTIAL_PLUGIN_VUE__` 上。于是：

```ts
import { ref, computed, h } from 'vue'
//                     ↑ 构建后被改写为从 shim 导入 → 拿到的是启动器的 ref
```

`vite.config.ts` 里的那行别名：

```ts
resolve: {
	// 把每一个 vue 导入——包括 SFC 编译器自己生成的——都指向 shim
	alias: [celestialVueAlias(projectRoot)],
},
```

只重定向**裸的 `vue`**。`vue-router` 之类如果将来开放给插件，需要各自的 shim。

## 两种写法

### 写法一：`.vue` 单文件组件（推荐）

模板里有 `src/SidebarCard.vue`。可以直接写 `<script setup>`：

```vue
<script setup lang="ts">
defineProps<{
	pluginName: string
	version: string
	opens: number
}>()

const emit = defineEmits<{ open: [] }>()
</script>

<template>
	<div class="my-plugin-card" @click="emit('open')">
		<span>{{ pluginName }}</span>
		<span class="my-plugin-detail">已启动 {{ opens }} 次 · v{{ version }}</span>
	</div>
</template>
```

SFC 编译器生成的代码里有一大堆 `import { ... } from 'vue'`（`createElementBlock`、`openBlock`、`toDisplayString`……），**这些全部由别名重定向**，所以能正确解析到启动器的运行时。

### 写法二：`api.vue` 渲染函数

不想引入 SFC 时，用 `api.vue` 提供的运行时函数：

```ts
api.routes.add({
	path: '/plugins/my-plugin',
	component: {
		name: 'MyPluginPage',
		setup() {
			const { h } = api.vue
			return () => h('div', { class: 'p-6' }, [h('h1', null, 'Hello')])
		},
	},
})
```

`api.vue` 提供的是启动器 Vue 的一个子集：

```ts
{
	h, ref, reactive, computed, watch, shallowRef, defineComponent,
	Teleport, onMounted, onUnmounted
}
```

::: tip 两种写法等价
`import { ref } from 'vue'` 和 `api.vue.ref` 拿到的是**同一个函数**（都指向启动器的）。选哪个看你顺不顺手。

写 `.vue` 文件时自然用 `import`；写纯渲染函数时用 `api.vue` 更直接。
:::

## 构建后必须自查

```bash
grep -c 'from"vue"\|from '"'"'vue'"'"'' dist/index.js
```

结果必须是 **0**。如果搜到了裸的 `import 'vue'`，说明别名没生效——插件加载时会失败。

应该看到的是从 `globalThis.__CELESTIAL_PLUGIN_VUE__` 读取的代码。

## 组件契约

### 插槽组件

`api.slots.add(slot, { id, component, props })`：

- `component` 是一个 Vue 组件（SFC 默认导出，或 `defineComponent` 的结果）。
- `props` 会被传进组件的 props。

```ts
api.slots.add('sidebar.top', {
	id: 'card',
	component: SidebarCard,
	props: {
		pluginName: api.plugin.name,
		onOpen: () => api.router.push('/plugins/my-plugin'),
	},
})
```

注意 `onOpen` —— Vue 的约定是「以 `on` 开头的 prop 当事件处理」，所以在 SFC 里 `defineEmits` 声明的事件，在这里用 `onXxx` 传。

### 也可以用 `render` 返回 DOM

不想用 Vue 组件时，`SlotDefinition` 还有一个 `render`：

```ts
api.slots.add('sidebar.top', {
	id: 'plain',
	render: () => {
		const el = document.createElement('div')
		el.textContent = '纯 DOM'
		return el
	},
})
```

**优先用 `component`。** `render` 返回的 DOM 不受 Vue 的响应式管理——启动器状态变了它不会更新。

## 可用的 UI 组件

`api.ui` 暴露了启动器自己的几个组件（来自 `@modrinth/ui`），让你的界面和启动器其他部分看起来一致：

```ts
const { Button, Input, Toggle, DropdownSelect } = api.ui
```

用 `h(...)` 渲染：

```ts
h(Button, { type: 'brand', onClick: handleClick }, () => '点击我')
```

只有**不需要启动器全局注入上下文**的组件才可用。想要更多，自己写一个——样式变量（见[样式](/plugin/styling)）能让你做出视觉一致的界面。

## 生命周期

- **`activate` 在应用渲染完之后调用一次。** 这时 DOM 已就绪，`api.regions.get(...)` 能拿到元素。
- **没有 `deactivate`。** 插件卸载时启动器自己清理：插槽、路由、事件订阅、sidecar 全部销毁。
- **组件卸载**照常用 `onUnmounted`（从 `api.vue` 或 `import` 都行）。

## 常见错误

| 现象 | 原因 |
|---|---|
| 插件加载失败，控制台说 `import 'vue'` | 别名没生效，产物里有裸 vue 导入 |
| 组件挂上了但不变 | 组件自己打包了一份 Vue，响应式断开了 |
| `globalThis.__CELESTIAL_PLUGIN_VUE__` 是 undefined | 插件不在启动器里跑（比如被单独 import 测试了） |
| 改了 `ref` 界面不更新 | 用了 `render` 返回的 DOM，不受响应式管理 |

---

接下来：[插槽](/plugin/slots)。
