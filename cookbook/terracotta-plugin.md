# 拆解：陶瓦联机插件

[celestial-terracotta](https://github.com/Wemsur/celestial-terracotta) 是最复杂的官方 UI 插件——654 行，把**sidecar** 和**局域网广播**两个重型能力拼成了一个可用的联机工具。

它值得完整读，因为几乎所有进阶的东西都在这里。

## 它解决什么问题

陶瓦（Terracotta）是一个开源联机工具：它通过公共中继节点，让两个玩家在没有端口转发的情况下互相连上对方的 Minecraft 世界。

这个插件做的事：

1. **下载并运行陶瓦程序**（原生二进制 → sidecar）。
2. **用界面控制它**（开房间 / 加入房间 / 显示房间号和玩家列表）。
3. **把连上的世界广播到局域网**，这样原版 Minecraft 客户端能在多人游戏列表里发现它（→ LAN）。

## manifest：一次用到七项权限

```json
{
	"id": "cn.terracotta.celestial",
	"name": "陶瓦联机",
	"version": "1.0.0",
	"type": "ui",
	"api_version": 1,
	"entry": "index.js",
	"permissions": [
		"style",
		"slot:sidebar.after-account",
		"route",
		"storage",
		"sidecar",
		"lan",
		"hostapi:auth.default_username",
		"network:gitee.com",
		"network:github.com",
		"network:api.github.com"
	]
}
```

逐项说明：

| 权限 | 风险 | 为什么 |
|---|---|---|
| `style` | 低 | 界面 CSS |
| `slot:sidebar.after-account` | 低 | 账号卡片下方那张紧凑卡片 |
| `route` | 低 | 左侧栏的联机页面 |
| `storage` | 低 | 记「已装版本」之类 |
| `sidecar` | **高** | 下载并运行陶瓦程序 |
| `lan` | **高** | 局域网广播 |
| `hostapi:auth.default_username` | **高** | 用账号名当默认玩家名 |
| `network:gitee.com` | **高** | 查版本（国内） |
| `network:github.com` | **高** | 下载（国内） |
| `network:api.github.com` | **高** | 查版本（备用） |

::: tip 三个网络域名是刻意的
- `gitee.com` —— **优先**用 Gitee 查版本和下载（国内快）。
- `github.com` —— Gitee 不行时的下载地址。
- `api.github.com` —— 版本查询的最后备选。

**一个都不能少**，因为 `mirrorsFor()` 和 `latestVersion()` 会依次尝试。

注意 `gitee.com` 和 `github.com` 是**下载域名**（`/releases/download/...`），而 `api.github.com` 是 **API 域名**——下载和查版本走的是不同的主机。
:::

## 关键代码

### 平台判断：macOS 直接拒绝

```ts
async function ensureAndStart() {
	if (api.platform.os === 'macos') {
		throw new Error('陶瓦联机暂不支持 macOS')
	}
	const version = await latestVersion()
	await ensureBinary(version)
	await refreshStatus()
	const started = await api.sidecar.start(SIDE_KEY, ['--hmcl', '{{PORT_FILE}}'], true)
	if (!started.port) throw new Error('未能获取陶瓦端口')
	handle = started.handle
	active.value = true
	startPolling()
}
```

::: warning 原生程序有平台限制
sidecar 是**原生可执行文件**，要为每个平台单独构建。陶瓦没有 macOS 版，所以插件在 macOS 上**明确报错**，而不是下载一个跑不起来的文件。

**写 sidecar 插件时，先检查 `api.platform.os`。** 不支持就早报错，别让用户等到下载完才失败。
:::

### 多镜像下载：逐个尝试

```ts
async function latestVersion() {
	try {
		const res = await api.net.fetch('https://gitee.com/api/v5/repos/burningtnt/Terracotta/releases/latest')
		if (res.ok) {
			const tag = JSON.parse(res.body).tag_name
			if (tag) return String(tag).replace(/^v/, '')
		}
	} catch (error) {
		api.log('gitee version lookup failed:', error)
	}
	const res = await api.net.fetch('https://api.github.com/repos/burningtnt/Terracotta/releases/latest')
	if (!res.ok) throw new Error('无法获取陶瓦版本')
	const tag = JSON.parse(res.body).tag_name
	if (!tag) throw new Error('无法获取陶瓦版本')
	return String(tag).replace(/^v/, '')
}

async function ensureBinary(version) {
	let lastError
	for (const url of mirrorsFor(version)) {
		try {
			await api.sidecar.ensure(SIDE_KEY, url, {
				sha512Url: `${url}.sha512`,
				archive: 'tar.gz',
				version,
			})
			return
		} catch (error) {
			lastError = error
			api.log('sidecar ensure failed for', url, error)
		}
	}
	throw lastError || new Error('陶瓦下载失败')
}
```

两个模式：

1. **查版本**：先 Gitee，失败/为空再 GitHub。**第一个成功就返回。**
2. **下载**：`mirrorsFor(version)` 返回一个 URL 列表（Gitee 优先），逐个 `ensure`，**全失败才抛最后一个错误**。

::: tip 保留 `lastError` 而不是吞掉
```ts
let lastError
for (const url of ...) {
	try { ...; return } catch (error) { lastError = error; api.log(...) }
}
throw lastError || new Error('陶瓦下载失败')
```

如果全部失败，抛出**最后一个**错误——它至少带着具体原因（网络错误、hash 不匹配等）。抛一个笼统的「下载失败」会丢掉诊断信息。
:::

### 校验和用 `.sha512` 旁路文件

```ts
await api.sidecar.ensure(SIDE_KEY, url, {
	sha512Url: `${url}.sha512`,   // 从 url + ".sha512" 取校验和
	archive: 'tar.gz',
	version,
})
```

不需要把 hash 硬编码进插件——**用 `sha512Url` 指向发布方提供的 `.sha512` 文件**，启动器自己去取。

::: tip 文件缺失只警告
`sha512Url` 的文件取不到时，启动器**只警告不失败**（这是为了兼容发布方没提供校验和的情况）。

见[原生 sidecar](/plugin/sidecar#ensure-key-url-options)。
:::

### 启动并拿到端口

```ts
const started = await api.sidecar.start(SIDE_KEY, ['--hmcl', '{{PORT_FILE}}'], true)
if (!started.port) throw new Error('未能获取陶瓦端口')
```

`--hmcl` 是陶瓦自己的参数，让它以「端口文件」模式启动。`{{PORT_FILE}}` 令牌被启动器替换成临时文件路径，然后轮询那个文件拿端口。

`true` 是 `portFile` 开关——**不传这个的话 `port` 永远是 `null`**。

### 轮询 sidecar 状态

```ts
function startPolling() {
	if (pollTimer) return   // ← 防重入
	pollTimer = setInterval(async () => {
		if (handle == null) return
		try {
			const res = await control('/state')
			if (!res.ok) return
			const data = JSON.parse(res.body)
			state.value = data.state || 'idle'
			if (data.room) roomCode.value = data.room
			players.value = Array.isArray(data.profiles)
				? data.profiles.map((profile) => profile.name).filter(Boolean)
				: []
			// ...
		} catch (error) {
			api.log('poll error:', error)
		}
	}, 1000)
}
```

::: warning `if (pollTimer) return` 是关键
页面和侧边栏卡片**都可能触发轮询**（用户可能两个都开着）。没有这行，会有两个定时器同时跑，请求翻倍。

**任何「启动一个后台任务」的函数都应该先检查有没有已经在跑。**
:::

注意轮询是 `setInterval`（固定 1 秒），而一言插件用的是递归 `setTimeout`。区别在于：**这里 1 秒的间隔是固定的**，不需要重新读设置，而且 `control` 很快。两种选择都合理，取决于你的需求。

### sidecar 状态驱动 LAN 广播

这是整个插件最巧妙的部分：

```ts
if (data.state === 'guest-ok' && data.url) {
	const port = Number.parseInt(String(data.url).split(':').pop(), 10)
	if (port && port !== announcedPort) {
		if (lanHandle != null) await api.lan.stop(lanHandle).catch(() => {})
		const announced = await api.lan.announce(MULTICAST_MOTD, port)
		lanHandle = announced.handle
		announcedPort = port
	}
}
```

流程：

1. 轮询发现陶瓦进入了 `guest-ok` 状态（**世界已经连上了**）。
2. 从 `data.url` 里解析出**本地端口**（陶瓦在本机开的转发端口）。
3. 如果这个端口和上次广播的不一样，**先停掉旧的广播，再广播新的**。

::: tip 为什么要「和上次不一样才广播」
`announce` 是**每 1.5 秒重复发**的——它是个持续动作，不是一次性的。如果每次轮询都调一次 `announce`，一秒就多一个广播任务，很快就堆积成几百个。

所以用 `announcedPort` 记住当前广播的是哪个端口，**只有端口变了才重建**。
:::

::: tip LAN 广播和 sidecar 是怎么配合的
陶瓦把远程世界转发到**本机的一个端口**（比如 `127.0.0.1:25565`）。

原版 Minecraft 的「对局域网开放」列表**不会**发现它——因为它不是 Minecraft 自己开的。

所以插件用 `api.lan.announce(motd, port)` 在局域网里广播一个假的「对局域网开放」，指向那个端口。用户的 Minecraft 客户端就会在多人游戏列表里看到它，点一下就进去了。

**这就是 LAN 能力存在的意义**：让一个非 Minecraft 来源的世界，对原版客户端可见。
:::

### 停止时全面清理

```ts
async function stop() {
	if (pollTimer) {
		clearInterval(pollTimer)
		pollTimer = null
	}
	if (handle != null) {
		try {
			await control('/panic?peaceful=true')   // 先让陶瓦自己优雅退出
		} catch (error) {
			api.log('panic failed:', error)
		}
		try {
			await api.sidecar.stop(handle)           // 再杀掉进程
		} catch (error) {
			api.log('stop failed:', error)
		}
		handle = null
	}
	if (lanHandle != null) {
		await api.lan.stop(lanHandle).catch(() => {})
		lanHandle = null
	}
	announcedPort = null
	active.value = false
	state.value = 'idle'
	roomCode.value = ''
	players.value = []
	statusMsg.value = ''
}
```

清理的顺序和内容都很讲究：

1. **先停轮询** —— 不然清理过程中轮询还在跑，可能又把状态改回去。
2. **先 `panic` 再 `stop`** —— 给陶瓦一个优雅退出的机会（它要通知中继节点），再强杀进程。
3. **停 LAN 广播** —— 否则用户退出联机后，局域网里还挂着一个连不上的世界。
4. **重置所有界面状态** —— 让界面回到初始态。

::: danger 每个 `stop` 都包 `try/catch`
```ts
try { await control('/panic?peaceful=true') } catch (error) { api.log('panic failed:', error) }
try { await api.sidecar.stop(handle) } catch (error) { api.log('stop failed:', error) }
await api.lan.stop(lanHandle).catch(() => {})
```

**清理过程中的失败不应该阻止其余清理。** 如果 `panic` 失败就抛出去，后面的 `sidecar.stop` 和 `lan.stop` 都不会执行——进程泄漏、广播不停。

**清理代码要尽力而为，每一步都独立。**
:::

### 注册页面 + 侧边栏入口

```ts
api.routes.add({
	path: ROUTE_PATH,
	name: 'terracotta',
	sidebar: showPage,           // ← 侧边栏开关（来自设置）
	title: '陶瓦联机',
	icon: '<svg ...>',           // ← 内联 SVG
	component: { name: 'TerracottaPage', setup() { /* ... */ } },
})
```

::: tip `sidebar` / `title` / `icon` 让页面出现在左侧导航栏
这三个字段是可选的：

- **`sidebar`** —— 是否在左侧导航栏显示入口。默认 `true`。这里绑定了用户的设置项（`show_page`），用户可以关掉。
- **`title`** —— 导航栏图标下方的文字。
- **`icon`** —— 一段**内联 SVG 字符串**（不是文件路径）。

不传 `sidebar` 时默认显示。传 `sidebar: false` 就是「注册了路由但不放导航入口」——适合从卡片跳转过去的页面。
:::

### 设置控制界面元素是否显示

```ts
if (showCard) api.slots.add('sidebar.after-account', { ... })
```

```json
{
	"key": "show_card",
	"label": "在右侧栏显示联机卡片",
	"type": "toggle",
	"default": "true"
}
```

::: tip 用设置控制「界面元素存不存在」
用户可能不想要侧边栏那张卡片（太占地方），或者不想要左侧栏那个图标。

插件在 `activate` 时读设置，**决定要不要注册**这些界面元素。代价是改了设置要重新加载插件（因为 `activate` 只跑一次）。

这是很实用的模式——**让用户能关掉你不想要的界面**。
:::

### 侧边栏卡片的生命周期

```ts
if (showCard) api.slots.add('sidebar.after-account', {
	id: 'terracotta-card',
	component: {
		name: 'TerracottaCard',
		setup() {
			const { onMounted, onUnmounted } = api.vue
			onMounted(() => {
				if (active.value && !pollTimer) startPolling()
			})
			onUnmounted(() => {
				if (pollTimer) {
					clearInterval(pollTimer)
					pollTimer = null
				}
			})
			return () => h('div', ...)
		},
	},
})
```

::: warning 卡片卸载时要停轮询
侧边栏卡片可能被卸载（用户切页面、关掉侧边栏）。卸载时如果不清理，轮询会**永远跑下去**——每秒一次请求，用户完全看不到。

`onMounted` 里重新启动（`active.value && !pollTimer` —— 只在联机中且没在跑时启动），`onUnmounted` 里停掉。
:::

### 玩家名从账号取

```ts
const username = await api.hostApi.call('auth.default_username')
```

用当前登录账号的用户名当默认玩家名，用户不用手输。

`auth.default_username` 是**只返回名字**的（不给凭据），这是刻意的设计——插件能拿到「你叫什么」，但拿不到你的登录信息。

## 小结：这篇教了什么

| 技巧 | 用在什么场合 |
|---|---|
| 检查 `api.platform.os` | 原生程序有平台限制 |
| 多镜像依次尝试 | 单一来源不可靠 |
| 保留 `lastError` | 别丢掉诊断信息 |
| `sha512Url` 旁路校验和 | 不硬编码 hash |
| `portFile: true` | 拿 sidecar 的端口 |
| `if (pollTimer) return` 防重入 | 后台任务只跑一个 |
| 记住上次的值避免重建 | 持续动作不该重复触发 |
| 清理时每步独立 `try/catch` | 尽力而为的清理 |
| `sidebar` / `title` / `icon` | 页面进左侧导航栏 |
| 用设置控制界面元素 | 让用户能关掉 |
| `onUnmounted` 停后台任务 | 组件卸载 |
| `hostApi` 读账号名 | 免手输 |

---

参考手册见[PluginHostApi 全量](/reference/plugin-api)。还有问题就看 [FAQ](/faq)。
