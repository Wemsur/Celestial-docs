# 调用宿主接口

`api.hostApi.call(name, ...args)` 让插件调用**启动器自己的函数**——读实例列表、拿实例详情、读多版本库。

```ts
const instances = await api.hostApi.call('instance.list')
```

需要 `hostapi:<名称>` 权限，这是**高风险**权限，用户要手动批准。

## 全部宿主接口

| 名称 | 参数 | 返回 |
|---|---|---|
| `instance.list` | `libraryPath?`（可选，指定某个库） | 实例数组 |
| `instance.get` | `instanceId` | 单个实例 |
| `library.list` | 无 | 多版本库信息 |
| `auth.default_username` | 无 | 当前账号的用户名，或 `null` |

::: warning 目前只有这四个
宿主接口是**白名单**——只有上面这四个。调用别的会抛错：

```ts
api.hostApi.call('something.else')
// → Error: Unknown host API "something.else".
```

以后可能增加，但**不会**变成一个「什么都能调」的万能入口——这个列表是刻意保持小的。
:::

::: tip 全都是只读的
这四个接口**都不改变启动器状态**。一个插件想「做点什么」（创建实例、装东西），走的是专门的、单独授权的接口，不是这个通用调用面。
:::

## 用法

```ts
const instances = await api.hostApi.call('instance.list')
const instance = await api.hostApi.call('instance.get', 'abc123')
const library = await api.hostApi.call('library.list')
const username = await api.hostApi.call('auth.default_username')
```

### `instance.list`

```ts
const instances = await api.hostApi.call('instance.list')
// 返回一个数组

// 指定某个多版本库
const inLibrary = await api.hostApi.call('instance.list', '/path/to/library')
```

::: warning 返回类型是 `unknown`
SDK 里这些调用的返回类型是 `unknown` / `unknown[]`——**没有强类型**。你自己判断形状：

```ts
const raw = await api.hostApi.call('instance.list')
const instances = Array.isArray(raw) ? raw : []
```

官方 hello-world 就是这么做的。
:::

### `instance.get`

```ts
const instance = await api.hostApi.call('instance.get', 'abc123')
```

不传 id 会抛错：

```ts
api.hostApi.call('instance.get')
// → Error: instance.get needs an instance id
```

### `library.list`

多版本库信息。用于「这个启动器有几个库、各叫什么」。

### `auth.default_username`

当前默认账号的用户名（**只有名字，没有凭据**）：

```ts
const username = await api.hostApi.call('auth.default_username')
// 'Steve' 或 null（没登录）
```

## 高风险：必须优雅降级

`hostapi:<名称>` 是**高风险**权限。用户没批准时调用会抛错：

```
Plugin "com.example.x" cannot use hostApi: the "hostapi:instance.list" permission has not been granted.
```

::: danger 不包 try 会让整个插件挂掉
```ts
// ❌ activate 抛错 → 插件的卡片、页面、样式全都不工作
const instances = await api.hostApi.call('instance.list')
```
:::

正确写法：

```ts
let instanceCount: number | null = null
try {
	const raw = await api.hostApi.call('instance.list')
	instanceCount = Array.isArray(raw) ? raw.length : 0
} catch {
	instanceCount = null // 未授权
}
```

然后在界面上**告诉用户为什么看不到数据**：

```ts
h('span', null, instanceCount === null
	? '实例数量：未授权读取（需要 hostapi:instance.list 权限）'
	: `实例数量：${instanceCount}`)
```

官方的 hello-world 插件就是标准示范——它声明了 `hostapi:instance.list`，但把调用包在 `try` 里，未授权时显示「未授权读取」而不是崩溃。

## manifest 声明

```json
"permissions": ["hostapi:instance.list", "hostapi:library.list"]
```

每一项要**单独声明**，用接口名当 scope。声明了 `hostapi:instance.list` **不代表**能调 `instance.get`。

## 完整例子

```ts
import type { PluginHostApi } from '@celestial/plugin'

export async function activate(api: PluginHostApi): Promise<void> {
	const { h, ref } = api.vue

	const state = ref<{ ok: boolean; count: number; username: string | null }>({
		ok: false,
		count: 0,
		username: null,
	})

	try {
		const raw = await api.hostApi.call('instance.list')
		const instances = Array.isArray(raw) ? raw : []
		const username = await api.hostApi.call('auth.default_username')

		state.value = {
			ok: true,
			count: instances.length,
			username: typeof username === 'string' ? username : null,
		}
	} catch (error) {
		// 用户没批准高风险权限，降级显示
		api.log('读取实例失败（可能是未授权）', error)
	}

	api.slots.add('sidebar.top', {
		id: 'card',
		component: {
			name: 'InstanceCard',
			setup() {
				return () =>
					h('div', { class: 'p-3 text-sm' }, [
						state.value.ok
							? h('span', null, `${state.value.count} 个实例 · ${state.value.username ?? '未登录'}`)
							: h('span', { class: 'opacity-80' }, '未授权读取实例'),
					])
			},
		},
	})
}
```

## 常见错误

| 现象 | 原因 |
|---|---|
| `Unknown host API "xxx"` | 接口名不在白名单里，或者拼错了 |
| `cannot use hostApi: the "hostapi:xxx" permission has not been granted` | manifest 里没声明这项，或者用户没批准 |
| `instance.get needs an instance id` | 忘了传 id |
| 返回值用起来报错 | 返回类型是 `unknown`，要自己判断形状 |
| 插件整个不工作 | 调用没包 `try`，`activate` 抛错了 |

---

接下来：[接管结构区域](/plugin/regions)。
