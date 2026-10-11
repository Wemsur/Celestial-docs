# 接管结构区域

`api.regions` 让你拿到启动器界面里**三个结构性区域**的容器元素，从而可以重排、包裹、改造那部分 chrome。

```ts
const topbar = api.regions.get('topbar')
topbar.append(myElement)
```

需要 `region:<区域>` 权限，这是**高风险**权限。

## 三个区域

| 区域 | 是什么 |
|---|---|
| `navbar` | 左侧主导航栏 |
| `topbar` | 顶部栏 |
| `sidebar` | 侧边栏 |

::: danger 这是「重排结构」，比插槽危险得多
插槽是**往一个位置加东西**——加坏了最多是难看。

区域是**把整个容器交给你**——你可以重排它、清空它、让它塌掉。一个把 `topbar` 改坏的插件，会让用户连窗口按钮和返回按钮都找不到。

所以它是高风险权限，用户要手动批准。
:::

## 用法

```ts
api.regions.get('topbar') // 返回 HTMLElement
```

拿到的是**启动器渲染的那个容器元素**（带 `data-plugin-region="topbar"` 标记的那个）。

### 常见做法

**追加一个元素**（最安全）：

```ts
const topbar = api.regions.get('topbar')
const badge = document.createElement('div')
badge.className = 'my-badge'
badge.textContent = 'Hi'
topbar.append(badge)
```

**重新排列已有的子元素**：

```ts
const topbar = api.regions.get('topbar')
// 注意：这会改变启动器自己的布局，要小心
```

## 和插槽的关系

**大多数情况下你不需要区域，插槽就够了。**

| 你想做的事 | 用什么 |
|---|---|
| 往顶栏加一个按钮 | 插槽 `topbar.right` |
| 往侧边栏加一张卡片 | 插槽 `sidebar.top` |
| **重排**顶栏里已有的元素顺序 | 区域 `topbar` |
| **包裹**整个侧边栏做自定义布局 | 区域 `sidebar` |

如果你只是想「加点东西」，用插槽——它是低风险权限，而且不会被启动器的布局更新冲掉。

## 会抛错的情况

```ts
api.regions.get('topbar')
```

| 情况 | 错误 |
|---|---|
| 区域名不在白名单 | `Unknown region "xxx".` |
| 没有 `region:topbar` 权限 | `This plugin cannot access region "topbar": the "region:topbar" permission has not been granted.` |
| 那个区域当前不在屏幕上 | `Region "topbar" is not on screen.` |

::: warning 「区域不在屏幕上」是真的会发生
启动器的某些页面（比如全屏的实例启动页）可能不渲染顶栏。这时 `get('topbar')` 会抛「not on screen」。

所以**不要在 `activate()` 顶层无条件调用它**——要么包 `try`，要么在需要的时候（比如用户打开你的页面时）再取。
:::

```ts
// ✅ 需要时才取，且包 try
function tryGetTopbar(): HTMLElement | null {
	try {
		return api.regions.get('topbar')
	} catch {
		return null
	}
}
```

## manifest 声明

```json
"permissions": ["region:topbar"]
```

每个区域**单独声明**。声明 `region:topbar` 不代表能碰 `region:sidebar`。

## 完整例子

```ts
import type { PluginHostApi } from '@celestial/plugin'

export async function activate(api: PluginHostApi): Promise<void> {
	api.styles.add(`
		.my-topbar-badge {
			display: flex;
			align-items: center;
			margin-left: 8px;
			padding: 2px 8px;
			border-radius: 6px;
			background: var(--color-brand-highlight);
			color: var(--color-text-primary);
			font-size: 12px;
		}
	`)

	try {
		const topbar = api.regions.get('topbar')
		const badge = document.createElement('span')
		badge.className = 'my-topbar-badge'
		badge.textContent = api.plugin.name
		topbar.append(badge)
	} catch (error) {
		// 没批准，或者区域不在屏幕上 —— 不致命，插件其余部分照常
		api.log('无法访问 topbar 区域', error)
	}
}
```

## 常见错误

| 现象 | 原因 |
|---|---|
| `Unknown region "xxx"` | 区域名拼错，只有 `navbar` / `topbar` / `sidebar` |
| `cannot access region "topbar": ... has not been granted` | manifest 里没声明，或者用户没批准 |
| `Region "topbar" is not on screen.` | 当前页面不渲染这个区域，换个时机取 |
| 启动器界面被我改乱了 | 区域是高风险能力，改动要保守；优先考虑插槽 |

---

接下来：[设置与存储](/plugin/settings-storage)。
