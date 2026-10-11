# 设置与存储

内容源有两套「存放东西」的机制：

| | `settings` | `storage` |
|---|---|---|
| 谁提供 | manifest 声明字段，启动器生成表单 | 你的代码自由读写 |
| 谁改 | **只有用户**（在设置页里改） | 只有你的代码 |
| 你的权限 | **只读**（`api.settings.get`） | 读写（`api.storage.*`） |
| 典型用途 | API Key、线路选择 | 缓存、登录态、手动条目 |

一句话：**用户配置的走 `settings`，插件自己的数据走 `storage`。**

## settings：让用户配置

在 manifest 里声明字段，启动器**自动生成表单**，用户填的值你直接读。

```json
"settings": [
	{
		"key": "apiKey",
		"label": "API Key",
		"description": "留空则使用内置值。",
		"type": "text",
		"default": ""
	},
	{
		"key": "region",
		"label": "线路",
		"type": "select",
		"default": "auto",
		"options": [
			{ "value": "auto", "label": "自动" },
			{ "value": "mirror", "label": "镜像" }
		]
	}
]
```

### 字段

| 字段 | 说明 |
|---|---|
| `key` | 存储键名，不能为空 |
| `label` | 表单上显示的名称 |
| `description` | 可选的说明 |
| `type` | `text`、`number`、`toggle`、`select` |
| `default` | 默认值，**字符串** |
| `options` | `select` 专用。`select` 没有 `options` 会被拒绝 |

### 读取

```ts
const apiKey = await api.settings.get('apiKey') // string | null
const all = await api.settings.all() // Record<string, string>
```

::: warning `settings` 是只读的
**要改值，只能让用户去设置页改。** 你的代码改不了。

如果插件需要存「用户不用看见的东西」（比如自动获取的 token），用 `storage`。
:::

### 值一律是字符串

即使是 `number` 和 `toggle`：

```ts
const limit = Number((await api.settings.get('pageSize')) ?? '20')
const hideEmpty = (await api.settings.get('hideNotDownloadable')) === 'true'
```

### `default` 和「没填过」

| 情况 | `api.settings.get(key)` 返回 |
|---|---|
| 用户填了值 | 那个值 |
| 用户没填，manifest 有 `default` | `default` |
| 用户没填，manifest 没有 `default` | `null` |

所以判空用 `??`：

```ts
const token = await api.settings.get('token')
const headers = token ? { authorization: `Bearer ${token}` } : {}
```

## storage：插件自己的数据

按插件隔离的键值存储，落在启动器的数据目录里。

```ts
await api.storage.get('cookie') // string | null
await api.storage.set('cookie', 'abc123')
await api.storage.remove('cookie')
await api.storage.keys() // string[]
```

### 值一律是字符串

存对象要自己序列化：

```ts
// 存
await api.storage.set('cache', JSON.stringify({ items, fetchedAt: Date.now() }))

// 读
const raw = await api.storage.get('cache')
const cache = raw ? JSON.parse(raw) : null
```

::: warning `JSON.parse` 要防 null 和坏数据
存储里的东西可能来自旧版本的插件（结构变了），也可能被手动改坏。稳妥的写法：

```ts
function readJson<T>(raw: string | null, fallback: T): T {
	if (!raw) return fallback
	try {
		return JSON.parse(raw) as T
	} catch {
		return fallback
	}
}
```
:::

### 卸载时数据怎么办

卸载插件时，启动器会问用户是否一并删除数据。**不删的话，重装能恢复**——这对「用户填过的 token」很重要。

## 用哪个：判断标准

| 你要存的东西 | 用哪个 |
|---|---|
| API Key、站点账号 | `settings`（用户要能改，也能看到它存在） |
| 线路 / 镜像选择 | `settings`（这是用户偏好） |
| 是否隐藏某些条目 | `settings` |
| 登录后拿到的 cookie / token | `storage`（用户不需要看，插件自己管） |
| 搜索结果缓存 | `storage` |
| 手动添加的条目 | `storage`（键名固定 `manualEntries`，见下） |
| 「这个项目上次装的是哪个版本」 | `storage` |

## 手动条目存在 `storage` 里

如果你用了 `manual_entry`，启动器把用户添加的条目存在 `storage` 的固定键 **`manualEntries`** 下：

```ts
const raw = await api.storage.get('manualEntries') // JSON 字符串或 null
const entries = raw ? JSON.parse(raw) : []
// entries 是对象数组，每个对象的键是 manual_entry 里各字段的 key
```

```ts
// [{ repo: 'FabricMC/fabric-api', type: 'mod', name: 'Fabric API' }, ...]
```

详见[手动条目](/source/manual-entry)。

## 完整例子

```ts
import type { ContentSourceApi } from '@celestial/content-source'

export async function activate(api: ContentSourceApi) {
	async function authHeaders(): Promise<Record<string, string>> {
		// 用户配置的 key 走 settings
		const apiKey = await api.settings.get('apiKey')
		// 登录态的 cookie 走 storage
		const cookie = await api.storage.get('cookie')

		return {
			accept: 'application/json',
			...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
			...(cookie ? { cookie } : {}),
		}
	}

	async function get<T>(path: string): Promise<T> {
		const response = await api.net.fetch(`https://example.com/api${path}`, {
			headers: await authHeaders(),
		})
		if (!response.ok) throw new Error(`示例站返回 ${response.status}`)
		return JSON.parse(response.body) as T
	}

	// 带缓存
	async function getCached<T>(path: string, ttlMs: number): Promise<T> {
		const key = `cache:${path}`
		const raw = await api.storage.get(key)
		if (raw) {
			try {
				const cached = JSON.parse(raw) as { at: number; value: T }
				if (Date.now() - cached.at < ttlMs) return cached.value
			} catch {
				// 坏数据，当作没缓存
			}
		}
		const value = await get<T>(path)
		await api.storage.set(key, JSON.stringify({ at: Date.now(), value }))
		return value
	}

	api.register({
		async search(request) {
			const page = await getCached<any>(`/search?q=${encodeURIComponent(request.query ?? '')}`, 60_000)
			return { items: page.hits.map(toCard), total: page.total }
		},
	})
}
```

## 常见错误

| 现象 | 原因 |
|---|---|
| 设置页没有我要的字段 | manifest 里没声明，或者 `key` 拼错 |
| `select` 类型的设置报错 | 声明了 `select` 但没有 `options` |
| `settings.get` 返回 `null` 但我填了 | 字段 `key` 和代码里读的不一致 |
| 存了对象，读出来是 `[object Object]` | 忘了 `JSON.stringify` |
| `JSON.parse` 抛错 | 存储里是旧结构或坏数据，要 `try/catch` |
| 改不了设置值 | `settings` 是只读的，要用户去设置页改 |

---

接下来：[手动条目](/source/manual-entry)。
