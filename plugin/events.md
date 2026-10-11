# 订阅事件

`api.events.on(...)` 让你对启动器里发生的事情做出反应——实例被创建/删除、安装进度变化、日志产生等等。

```ts
const unsubscribe = api.events.on('instance', (payload) => {
	// 实例列表变了
})
```

需要 `event:<类型>` 权限（低风险，自动授予）。

## 全部事件

| 事件 | 什么时候触发 | payload |
|---|---|---|
| `instance` | 实例被创建、删除、修改 | 实例信息 |
| `instance_groups_changed` | 实例分组变化 | 分组信息 |
| `instance_bulk_update_progress` | 批量更新实例的进度 | 进度信息 |
| `process` | 启动器进程状态变化（游戏启动/退出等） | 进程状态 |
| `install_job` | 安装任务的进度 | 任务进度 |
| `library_changed` | 多版本库变化（切换、新建库） | 库信息 |
| `log` | 启动器产生一条日志 | 日志内容 |

::: warning 事件是「通知」，不是「完整数据」
payload 的形状**没有强类型保证**（SDK 里是 `unknown`）。它是给你「知道发生了什么事」用的，具体数据一般还是要通过 `api.hostApi.call('instance.list')` 之类的接口去取。

官方 hello-world 的做法就是这样——收到 `instance` 事件后，重新调一次 `instance.list` 拿最新数据。
:::

## 用法

```ts
export async function activate(api: PluginHostApi) {
	const { ref } = api.vue

	const lastEvent = ref('（暂无）')

	// 返回一个取消订阅的函数
	const unsubscribe = api.events.on('instance', () => {
		lastEvent.value = new Date().toLocaleTimeString()
	})

	// 通常不需要手动调用 unsubscribe —— 插件卸载时启动器会自动清理。
	// 但如果你想在插件运行期间停止接收，可以调用它。
}
```

### 返回值

`api.events.on(...)` 返回一个**取消订阅函数**：

```ts
const unsubscribe = api.events.on('instance', handler)
// ...
unsubscribe() // 停止接收
```

::: tip 一般不用手动取消
插件卸载时，启动器会**自动清理所有订阅**。所以除非你想在插件运行期间动态停止接收某个事件，否则不用管返回值。
:::

## 权限

`event:<类型>` 是**低风险**权限，声明了就自动授予：

```json
"permissions": ["event:instance", "event:process"]
```

::: danger 没声明的后果是抛错
```ts
api.events.on('instance', handler)
// → Error: Plugin "com.example.x" cannot listen to "instance": the "event:instance" permission has not been granted.
```

如果这行在 `activate()` 顶层没包 `try`，**整个插件启动失败**。所以要么确保声明了，要么包 `try`。
:::

## 事件类型是白名单

插件**只能订阅白名单上的事件**——启动器内部的一些信号不给插件听：

```ts
api.events.on('some_internal_event', handler)
// → Error: Event "some_internal_event" is not available to plugins.
```

只有上表里那七个。

## 一个插件的 handler 抛错不会影响别人

启动器把每个 handler 包了一层——你的 handler 抛错只会记录日志，**不会中断其他插件的 handler，也不会让启动器崩**。

但这意味着**你自己抛的错不会被自动上报**。如果你需要知道 handler 里的失败，自己 `try/catch` + `api.log`：

```ts
api.events.on('install_job', async () => {
	try {
		await refresh()
	} catch (error) {
		api.log('刷新失败', error)
	}
})
```

## 完整例子

```ts
import type { PluginHostApi } from '@celestial/plugin'

export async function activate(api: PluginHostApi): Promise<void> {
	const { h, ref } = api.vue

	const instanceCount = ref<number | null>(null)
	const lastEvent = ref('（暂无）')

	async function refreshInstanceCount() {
		try {
			const instances = await api.hostApi.call('instance.list')
			instanceCount.value = Array.isArray(instances) ? instances.length : 0
		} catch {
			// hostapi:instance.list 是高风险权限，用户可能没批准
			instanceCount.value = null
		}
	}

	await refreshInstanceCount()

	// event:instance 是低风险，装上就能用
	api.events.on('instance', () => {
		lastEvent.value = new Date().toLocaleTimeString()
		void refreshInstanceCount()
	})

	api.slots.add('sidebar.top', {
		id: 'card',
		component: {
			name: 'InstanceCard',
			setup() {
				return () =>
					h('div', { class: 'p-3 text-sm' }, [
						h('span', null, instanceCount.value === null ? '实例：未授权' : `实例：${instanceCount.value}`),
						h('span', { class: 'block text-xs opacity-80' }, `最近事件 ${lastEvent.value}`),
					])
			},
		},
	})
}
```

这个例子里：

- `event:instance`（低风险）→ 订阅成功，实例变化时卡片更新。
- `hostapi:instance.list`（高风险）→ 用户没批准时降级为「未授权」，**插件不崩**。

## 常见错误

| 现象 | 原因 |
|---|---|
| `cannot listen to "instance": the "event:instance" permission has not been granted` | manifest 里没声明 `event:instance` |
| `Event "xxx" is not available to plugins` | 事件名不在白名单里 |
| 收到事件但数据不对 | payload 是 `unknown`，要自己判断形状，或者重新调宿主接口取 |
| 事件触发太频繁 | 有些事件（如 `log`）会很密集，handler 要轻 |

---

接下来：[调用宿主接口](/plugin/hostapi)。
