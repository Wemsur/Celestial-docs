# 局域网联机

`api.lan` 让插件在**局域网里广播一个 Minecraft「对局域网开放」的世界**，这样用户的 Minecraft 客户端会在多人游戏列表里自动发现它。

这是给联机类插件用的——世界其实是通过别的途径（比如一个隧道）连进来的，但让原版客户端能发现它，需要发这个广播。

```ts
const { handle } = await api.lan.announce('某某的世界', 25565)
```

需要 `lan` 权限（**高风险**）。

## 为什么要原生实现

Minecraft 发现局域网游戏的方式是监听 **UDP 多播** `224.0.2.60:4445`，包体格式是：

```
[MOTD]<名字>[/MOTD][AD]<端口>[/AD]
```

**webview 开不了多播 socket**，所以这件事必须在原生层做。这就是它需要一个单独权限的原因。

## `announce(motd, port)`

开始广播，**每 1.5 秒重复一次**，直到 `stop` 或插件卸载。

```ts
const { handle } = await api.lan.announce('我的世界', 25565)
```

| 参数 | 说明 |
|---|---|
| `motd` | 显示在客户端多人游戏列表里的名字 |
| `port` | 客户端要连的端口。**不能是 0** |

返回 `{ handle }`，用来停止。

::: warning `motd` 里的方括号会被去掉
包体用 `[MOTD]...[/MOTD]` 分隔。名字里有方括号会破坏格式，所以启动器**自动把它们删掉**。

`"我的[测试]世界"` → `"我的测试世界"`
:::

## `stop(handle)`

停止广播。

```ts
await api.lan.stop(handle)
```

::: tip 一般不用手动停
插件卸载、应用退出时，启动器会停掉所有广播。手动 `stop` 只在你想主动关闭时用。
:::

## 谁会发现它

局域网里**任何**开着 Minecraft 的客户端——不只是本机的。这正是这个能力要小心的地方：持有 `lan` 权限的插件，能往局域网里每台机器的多人游戏列表里塞一个条目。

所以它是高风险权限，用户要手动批准。

## 完整例子

联机类插件的典型流程：

```ts
import type { PluginHostApi } from '@celestial/plugin'

export async function activate(api: PluginHostApi): Promise<void> {
	let lanHandle: number | null = null

	async function startHosting(motd: string, port: number) {
		try {
			const { handle } = await api.lan.announce(motd, port)
			lanHandle = handle
			api.log(`已开始广播「${motd}」，端口 ${port}`)
		} catch (error) {
			// lan 权限没批准 —— 降级
			api.log('无法广播（可能是未授权）', error)
		}
	}

	async function stopHosting() {
		if (lanHandle !== null) {
			await api.lan.stop(lanHandle)
			lanHandle = null
		}
	}

	// 通常由界面上的按钮触发
	api.slots.add('sidebar.top', {
		id: 'host-button',
		component: {
			name: 'HostButton',
			setup() {
				const { h } = api.vue
				return () =>
					h('button', { class: 'm-2', onClick: () => void startHosting('我的世界', 25565) }, '开放到局域网')
			},
		},
	})
}
```

## 和 sidecar 一起用

联机插件通常**两个一起用**：sidecar 跑隧道程序，LAN 广播让客户端能发现。

官方的陶瓦联机插件就是这样——它跑一个 sidecar，然后广播一个局域网世界指向它。见[拆解：陶瓦联机插件](/cookbook/terracotta-plugin)。

## 常见错误

| 现象 | 原因 |
|---|---|
| `cannot use lan: the "lan" permission has not been granted` | manifest 没声明 `lan`，或用户没批准 |
| `LAN announce port must not be zero` | 端口传了 0 |
| 客户端看不到世界 | 防火墙挡了 UDP 4445，或者不在同一网段 |
| motd 里的方括号没了 | 故意的，见上 |

---

参考手册见[PluginHostApi 全量](/reference/plugin-api)。接下来去[配方](/cookbook/)看真实插件。
