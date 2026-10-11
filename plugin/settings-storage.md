# 设置与存储

UI 插件的设置和内容源**几乎一样**，只有一处差异。这一页只讲差异，共同的部分见[内容源的设置与存储](/source/settings-storage)。

## 差异：`settings.render`

UI 插件多了一个能力——**往设置页里加自己的 UI**：

```ts
api.settings.render({
	id: 'my-extra-ui',
	component: MySettingsPanel,
})
```

它把组件渲染到**你的设置弹窗底部**，让你在声明式表单之外做更复杂的配置界面。

```ts
{
	id: string // 唯一
	component?: Component // Vue 组件
	props?: Record<string, unknown>
	render?: () => Node | null | void // 或者返回 DOM
}
```

::: tip 什么时候用 `render`
声明式 `settings`（manifest 里那几个字段）能覆盖「一个文本框、一个开关、一个下拉」这种需求。要**更复杂的东西**——比如一个列表编辑器、一个带预览的配置面板——才用 `settings.render` 自己画。

自己画的界面里要读写数据，用 `api.storage`（见下）。
:::

## 存储：同一个命名空间

和内容源一样：

```ts
await api.storage.get(key) // string | null
await api.storage.set(key, value)
await api.storage.remove(key)
await api.storage.keys()
```

::: warning `settings` 和 `storage` 共用同一个存储
manifest 里声明的设置字段，和 `api.storage` 读写的是**同一个存储**。所以：

- 用户通过设置页写的值，你可以用 `api.storage.get(设置key)` 读到。
- 你 `api.storage.set(设置key, ...)` 写进去的值，**会显示在设置页的表单里**。

因此**别让设置的 `key` 和你的内部存储键撞名**——撞了的话，你写进去的内部数据会突然出现在用户的设置表单里。
:::

## 读取设置

```ts
const interval = Number((await api.settings.get('refreshInterval')) ?? '30')
const enabled = (await api.settings.get('featureOn')) === 'true'
const all = await api.settings.all() // Record<string, string>
```

`settings` 是**只读的**——要改值只能让用户在设置页改。

## 完整例子

manifest：

```json
{
	"settings": [
		{
			"key": "refreshInterval",
			"label": "刷新间隔（秒）",
			"type": "number",
			"default": "30"
		},
		{
			"key": "showAvatar",
			"label": "显示头像",
			"type": "toggle",
			"default": "true"
		}
	]
}
```

插件：

```ts
import type { PluginHostApi } from '@celestial/plugin'

export async function activate(api: PluginHostApi): Promise<void> {
	const interval = Number((await api.settings.get('refreshInterval')) ?? '30')
	const showAvatar = (await api.settings.get('showAvatar')) === 'true'

	// 自己的内部状态走 storage，用不会和设置撞名的键
	const lastRun = await api.storage.get('internal:lastRun')
	await api.storage.set('internal:lastRun', String(Date.now()))

	api.log(`刷新间隔 ${interval}s，显示头像 ${showAvatar}，上次运行 ${lastRun ?? '从未'}`)
}
```

注意内部键用了 `internal:` 前缀——避免和 manifest 里的设置 key 撞。

## 常见错误

| 现象 | 原因 |
|---|---|
| 设置改了插件没反应 | 读的是缓存的旧值；应该在每次需要时读，而不是 `activate` 里读一次 |
| 我写的内部数据出现在设置表单里 | 存储键和某个设置的 `key` 撞了 |
| `settings.render` 的组件不显示 | 没有对应的权限？不——`settings` 不受权限控制，检查组件本身有没有抛错 |
| 改不了设置 | `settings` 是只读的 |

---

接下来：[原生 sidecar](/plugin/sidecar)。
