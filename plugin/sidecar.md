# 原生 sidecar

sidecar 是 UI 插件**最强大的能力**：下载一个原生可执行文件，运行它，通过 localhost 和它通信。

Terracotta（陶瓦联机）就是用这个做的——它跑一个原生的联机程序，插件界面负责配置和显示。

```ts
await api.sidecar.ensure('terracotta', url, { sha512, archive: 'tar.gz' })
const { handle, port } = await api.sidecar.start('terracotta', ['--port', '0'], true)
const response = await api.sidecar.request(handle, { path: '/status' })
```

需要 `sidecar` 权限（**高风险**），下载域名还需要 `network:<域名>`。

::: danger 这是最高危的能力
sidecar 运行的是**原生代码**，跑在 webview 沙箱**外面**。它能做用户的任何进程能做的事。

所以：

- 用户必须**手动批准** `sidecar` 权限。
- 下载的域名也要在权限列表里，用户看得到「这个插件要从哪里下东西」。
- 启动器**拥有进程**：插件卸载、应用退出时，sidecar 会被杀掉。
:::

## `ensure(key, url, options?)`

下载、校验、解包 sidecar。**幂等**——同一个 URL 已经装好了就是空操作。

```ts
await api.sidecar.ensure(
	'terracotta', // key：这个 sidecar 在你插件内的名字
	'https://example.com/terracotta-v1.2.3-linux-amd64.tar.gz',
	{
		sha512: 'abc123...', // 可选，给了就校验
		sha512Url: 'https://example.com/...tar.gz.sha512', // 或者给一个 .sha512 文件地址
		archive: 'tar.gz', // 'tar.gz'（默认）| 'zip' | 'none'
		version: '1.2.3', // 可选，记录版本
	},
)
```

| 参数 | 说明 |
|---|---|
| `key` | 你自己起的名字。一个插件可以有多个 sidecar，各用不同的 key |
| `url` | 下载地址。**域名必须在 `hosts`/权限里** |
| `sha512` | 期望的 sha512。给了就校验 |
| `sha512Url` | 一个指向 `.sha512` 文件的地址。文件缺失只警告，不失败 |
| `archive` | `'tar.gz'`、`'zip'`、或 `'none'`（裸可执行文件） |
| `version` | 记录的版本号，`status()` 能读回来 |

### `key` 的规则

只能字母、数字、`.`、`-`、`_`，不能含 `/` 或 `\`——因为它会被用作目录名。

### 幂等性

同一个 key + 同一个 URL 重复 `ensure`，是空操作。所以可以放心在每次 `activate` 里调——它不会重复下载。

### 校验

```ts
await api.sidecar.ensure('tool', url, { sha512: 'abc...' })
```

校验失败会抛错，不安装。

::: tip 下载域名要在权限里
`ensure` 的 URL 域名会对照你的 `network:` 授权检查。所以 manifest 要声明：

```json
"permissions": ["sidecar", "network:example.com"]
```
:::

## `status(key)`

查一个 sidecar 装没装、装的什么版本。

```ts
const { installed, version } = await api.sidecar.status('terracotta')
// { installed: true, version: '1.2.3' }
```

不需要 `sidecar` 权限就能调（只是查状态）。

## `start(key, args, portFile?)`

启动 sidecar。

```ts
const { handle, port } = await api.sidecar.start(
	'terracotta',
	['--port', '0', '--port-file', '{{PORT_FILE}}'],
	true, // portFile：让启动器处理端口文件
)
```

| 参数 | 说明 |
|---|---|
| `key` | 要启动的 sidecar |
| `args` | 命令行参数数组 |
| `portFile` | 见下 |

返回：

```ts
{
	handle: number // 进程句柄，request/stop 要用
	port: number | null // sidecar 报告的端口（请求了 portFile 时）
}
```

### `{{PORT_FILE}}` 端口约定

这是为 Terracotta 这类「让系统分配端口，再告诉调用者」的程序设计的。

传 `portFile: true` 时：

1. 启动器创建一个临时文件路径。
2. 把 `args` 里的 `{{PORT_FILE}}` 令牌**替换成那个路径**。
3. 启动进程。
4. **轮询那个文件**，等 sidecar 写进 `{"port": 12345}`。
5. 读到端口后，作为 `start()` 的返回值 `port` 给你。

所以你的 sidecar 要支持「往指定文件写端口号」这个约定。

```ts
// args 里带令牌
await api.sidecar.start('tool', ['--port-file', '{{PORT_FILE}}'], true)
// → 启动器把它变成 ['--port-file', 'C:\\...\\port-abc.json']
// → sidecar 写 {"port": 12345}
// → start() 返回 { handle: 1, port: 12345 }
```

不需要端口文件时传 `false`（或不传），`port` 就是 `null`。

## `request(handle, init)`

往运行中的 sidecar 发一个 HTTP 请求，**只走 `127.0.0.1`**。

```ts
const response = await api.sidecar.request(handle, {
	path: '/api/status?verbose=1', // 路径 + 查询串，原样发送
	method: 'GET',
	headers: { accept: 'application/json' },
	body: undefined,
})
```

返回：

```ts
{
	status: number
	ok: boolean
	body: string
}
```

### `path` 是原样发送的

`path` 是**路径加查询串**，启动器原样转发——所以重复的查询键能正常工作：

```ts
// ✅ 重复的键能表达
path: '/api/nodes?public_nodes=1&public_nodes=2'

// 用对象表达的话就丢了
```

（Terracotta 就需要 `public_nodes` 出现多次。）

### 只走 localhost，绕过代理

sidecar 的控制请求**强制走 `127.0.0.1`，且忽略系统代理**——本地端口不应该被代理路由。

## `stop(handle)`

停掉一个 sidecar。

```ts
await api.sidecar.stop(handle)
```

::: tip 一般不用手动停
插件卸载、应用退出时，启动器会杀掉所有 sidecar。手动 `stop` 只在你想在插件运行期间主动关闭某个进程时需要。
:::

## 完整流程

```ts
import type { PluginHostApi } from '@celestial/plugin'

const SIDECAR_URL = 'https://example.com/tool-v1.0.0-linux-amd64.tar.gz'

export async function activate(api: PluginHostApi): Promise<void> {
	let handle: number | null = null
	let port: number | null = null

	async function ensureRunning() {
		// 1. 确保装好了
		await api.sidecar.ensure('tool', SIDECAR_URL, { archive: 'tar.gz' })

		// 2. 启动，等它报告端口
		const started = await api.sidecar.start('tool', ['--port-file', '{{PORT_FILE}}'], true)
		handle = started.handle
		port = started.port

		api.log('sidecar 已启动，端口', port)
	}

	async function queryStatus() {
		if (handle === null) return null
		const response = await api.sidecar.request(handle, { path: '/status' })
		return response.ok ? JSON.parse(response.body) : null
	}

	try {
		await ensureRunning()
		api.log('状态', await queryStatus())
	} catch (error) {
		// sidecar 权限没批，或者下载失败 —— 降级
		api.log('sidecar 不可用', error)
	}
}
```

## 平台差异

sidecar 是**原生可执行文件**，所以不同平台需要不同的构建：

```ts
const { os, arch } = api.platform // { os: 'windows', arch: 'x86_64' }

const url = `https://example.com/tool-v1.0.0-${os}-${arch}.tar.gz`
```

`api.platform` **不需要权限**——它只是告诉你宿主环境。

## 常见错误

| 现象 | 原因 |
|---|---|
| `cannot use sidecar: the "sidecar" permission has not been granted` | manifest 没声明 `sidecar`，或用户没批准 |
| 下载被拒 | 下载 URL 的域名不在 `network:` 权限里 |
| `Sidecar 'x' is not installed` | 没先 `ensure`，或者 key 不一致 |
| 端口是 `null` | 没传 `portFile: true`，或者 sidecar 没按约定写端口文件 |
| sidecar 启动就退出 | 平台不对（下错了架构），或者文件没有可执行权限 |
| `ensure` 校验失败 | sha512 不对，或者站点更新了文件没更新 hash |

---

接下来：[局域网联机](/plugin/lan)。
