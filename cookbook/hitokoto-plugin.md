# 拆解：一言插件

[celestial-hitokoto](https://github.com/Wemsur/celestial-hitokoto) 是最小的 UI 插件——一个文件、124 行，在主页顶部显示一句轮换的名言。

它值得读，因为**几乎每个 UI 插件都会用到它里面的模式**：定时器、网络请求、插槽、设置读取、清理。

## 它解决什么问题

在主页顶部显示一言（`hitokoto.cn`）的随机句子，每隔 N 秒换一句。N 可以在插件设置里调。

就这么简单。它的价值在于**每个部分都是标准做法**。

## 整个插件

### `manifest.json`

```json
{
	"id": "cn.hitokoto.celestial",
	"name": "一言",
	"description": "在主页顶部显示一言（hitokoto.cn）的随机句子，定时轮换。可在插件设置里调整轮换秒数。",
	"version": "1.0.0",
	"author": "Celestial Launcher",
	"homepage": "https://hitokoto.cn/",
	"type": "ui",
	"api_version": 1,
	"entry": "index.js",
	"permissions": ["style", "slot:home.top", "network:v1.hitokoto.cn"],
	"settings": [
		{
			"key": "interval",
			"label": "轮换间隔（秒）",
			"description": "每隔多少秒获取一条新的一言，最小 3 秒。",
			"type": "number",
			"default": "10"
		}
	]
}
```

三个权限，各司其职：

| 权限 | 为什么需要 | 风险 |
|---|---|---|
| `style` | 卡片的 CSS | 低（自动授予） |
| `slot:home.top` | 挂在主页顶部 | 低（自动授予） |
| `network:v1.hitokoto.cn` | 请求一言 API | **高（需用户批准）** |

::: tip 网络权限是精确到域名的
`network:v1.hitokoto.cn` —— 只有这一个域名。不是 `network:hitokoto.cn`，更不是通配。

用户批准时看到的是「这个插件要访问 v1.hitokoto.cn」，而不是「要访问网络」。**这就是为什么域名要写精确。**
:::

### `index.js`

```js
export async function activate(api) {
	const { h, ref, onUnmounted } = api.vue

	api.styles.add(`
		.hitokoto-card {
			margin: 0 0 4px 0;
			padding: 14px 18px;
			border-radius: 12px;
			background: var(--color-raised-bg);
			border: 1px solid var(--color-button-bg);
			display: flex;
			flex-direction: column;
			gap: 6px;
			min-height: 44px;
			justify-content: center;
		}
		.hitokoto-text {
			color: var(--color-contrast);
			font-size: 0.95rem;
			line-height: 1.5;
		}
		.hitokoto-from {
			color: var(--color-secondary);
			font-size: 0.8rem;
			text-align: right;
		}
		.hitokoto-text--loading { color: var(--color-secondary); }
	`)

	const MIN_INTERVAL = 3

	async function currentIntervalMs() {
		const raw = await api.settings.get('interval')
		const seconds = Number(raw)
		if (!Number.isFinite(seconds) || seconds < MIN_INTERVAL) {
			return 10_000
		}
		return Math.round(seconds * 1000)
	}

	const text = ref('正在获取一言…')
	const from = ref('')
	const loading = ref(true)

	let timer
	let stopped = false

	async function fetchOne() {
		try {
			const response = await api.net.fetch('https://v1.hitokoto.cn/?encode=json')
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`)
			}
			const data = JSON.parse(response.body)
			if (stopped) return
			text.value = data.hitokoto ?? '（空）'
			const source = data.from_who ? `${data.from_who}《${data.from}》` : data.from
			from.value = source ? `——${source}` : ''
			loading.value = false
		} catch (error) {
			if (stopped) return
			text.value = '一言获取失败，稍后重试…'
			from.value = ''
			loading.value = false
			api.log('fetch failed:', error)
		}
	}

	async function scheduleNext() {
		if (stopped) return
		const delay = await currentIntervalMs()
		timer = setTimeout(async () => {
			await fetchOne()
			void scheduleNext()
		}, delay)
	}

	await fetchOne()
	void scheduleNext()

	api.slots.add('home.top', {
		id: 'hitokoto',
		component: {
			name: 'HitokotoCard',
			setup() {
				onUnmounted(() => {
					stopped = true
					clearTimeout(timer)
				})
				return () =>
					h('div', { class: 'hitokoto-card' }, [
						h(
							'div',
							{
								class: loading.value
									? 'hitokoto-text hitokoto-text--loading'
									: 'hitokoto-text',
							},
							text.value,
						),
						from.value ? h('div', { class: 'hitokoto-from' }, from.value) : null,
					])
			},
		},
	})

	api.log('activated')
}
```

## 逐段讲解

### 状态用 `ref`，界面用渲染函数

```js
const text = ref('正在获取一言…')
const from = ref('')
const loading = ref(true)
```

三个 `ref` 是**共享状态**——外面的 `fetchOne` 改它们，里面的渲染函数读它们。

```js
return () =>
	h('div', { class: 'hitokoto-card' }, [
		h('div', { class: loading.value ? '...--loading' : '...' }, text.value),
		from.value ? h('div', { class: 'hitokoto-from' }, from.value) : null,
	])
```

::: tip 渲染函数是「返回一个函数」
```js
setup() {
	return () => h('div', ...)   // ← 返回函数，不是 h(...) 本身
}
```

返回函数意味着 Vue 每次重渲染都会调用它。所以 `text.value` 变了，界面会更新。

**返回 `h(...)` 本身是错的**——那样只渲染一次，之后再也不更新。
:::

### 用 `?.` 和兜底处理不完整的响应

```js
text.value = data.hitokoto ?? '（空）'
const source = data.from_who ? `${data.from_who}《${data.from}》` : data.from
from.value = source ? `——${source}` : ''
```

一言 API 的响应里 `from_who`（作者）和 `from`（出处）**不一定都有**。所以：

- `hitokoto` 缺失时给一个占位符，不会是 `undefined` 显示在界面上。
- `from_who` 有就拼成「作者《出处》」，没有就只用 `from`。
- 两者都没有时，`from` 是空字符串，界面上**整个出处那一行不显示**。

```js
from.value ? h('div', { class: 'hitokoto-from' }, from.value) : null
```

`null` 在 Vue 的渲染函数里表示「什么都不渲染」——所以空出处时那一行不存在，不会留一个空 div 占位。

### 定时器用递归 `setTimeout` 而不是 `setInterval`

```js
async function scheduleNext() {
	if (stopped) return
	const delay = await currentIntervalMs()
	timer = setTimeout(async () => {
		await fetchOne()
		void scheduleNext()
	}, delay)
}
```

::: tip 为什么不用 `setInterval`
两个原因：

1. **每次重新读设置。** 用户改了轮换间隔，**下一次轮换**就生效，不用重载插件。`setInterval` 的间隔是固定的，改了要清掉重建。

2. **不会堆积。** `setInterval` 在 `fetchOne` 比间隔还慢时会堆积（前一个还没回来，下一个已经触发）。递归 `setTimeout` 保证**上一次完成后才开始计时下一次**。
:::

### `stopped` 标志：异步操作完成后要检查

```js
let stopped = false

async function fetchOne() {
	try {
		const response = await api.net.fetch(...)
		// ...
		if (stopped) return    // ← 检查
		text.value = data.hitokoto ?? '（空）'
	} catch (error) {
		if (stopped) return    // ← 检查
		// ...
	}
}
```

::: danger 这是一个真实的竞态
流程可能是这样的：

1. 插件开始请求一言（网络慢，要 2 秒）。
2. 用户在这 2 秒内**卸载了插件**（或者关掉了热重载）。
3. 请求返回，`fetchOne` 继续执行，去改 `text.value`。
4. 但组件已经卸载了——改一个不存在的组件的状态。

`stopped` 标志让「已经卸载了」这个事实能被后面的异步代码看到。
:::

### `onUnmounted` 里清理

```js
setup() {
	onUnmounted(() => {
		stopped = true
		clearTimeout(timer)
	})
	return () => h('div', ...)
}
```

两件事：

1. **`stopped = true`** —— 让正在进行的请求返回后不再改状态。
2. **`clearTimeout(timer)`** —— 停掉还没触发的下一次轮换。

::: warning 不清理的后果
不清理定时器的话，插件卸载后**它还会一直跑**——每隔 N 秒发一次请求，永远不停。

`onUnmounted` 是唯一能挂清理的地方（`api.vue` 提供的）。
:::

### 设置读取的错误兜底

```js
async function currentIntervalMs() {
	const raw = await api.settings.get('interval')
	const seconds = Number(raw)
	if (!Number.isFinite(seconds) || seconds < MIN_INTERVAL) {
		return 10_000
	}
	return Math.round(seconds * 1000)
}
```

用户可能在设置里填了 `0`、负数、或者根本删掉了那个值。三种情况都回落到 10 秒。

`!Number.isFinite(seconds)` 一次挡住 `NaN`（空字符串转换的结果）和 `Infinity`。

::: tip 设置值永远要当作不可信
用户在表单里能填任何东西。`Number(raw)` 的结果可能是 `NaN`。

`MIN_INTERVAL = 3` 的注释和设置项的 `description` 都写了「最小 3 秒」——**表单不会替你校验**，所以代码里要兜。
:::

### 网络权限被拒时会发生什么

```js
const response = await api.net.fetch('https://v1.hitokoto.cn/?encode=json')
```

如果用户**没批准** `network:v1.hitokoto.cn`，这行会抛错——被 `try/catch` 接住，界面显示「一言获取失败，稍后重试…」。

::: tip 这里没有专门处理「未授权」
这个插件没有区分「网络失败」和「权限没批」——两者都显示「获取失败」。

对这个小插件来说是够的。但如果你想让用户知道是权限问题，可以在 `catch` 里检查错误信息，显示「请在设置里批准网络权限」。
:::

## 小结：这篇教了什么

| 技巧 | 用在什么场合 |
|---|---|
| `api.vue` 的 `ref` + 渲染函数 | 不想引入 SFC |
| 渲染函数返回函数 | 响应式更新 |
| `?.` 和兜底值 | 响应字段可能缺失 |
| `null` 表示不渲染 | 可选的行 |
| 递归 `setTimeout` | 可变的间隔 + 不堆积 |
| `stopped` 标志 | 异步完成时可能已卸载 |
| `onUnmounted` 清理 | 定时器、订阅 |
| 设置值的错误兜底 | 用户输入不可信 |
| 用 CSS 变量 | 跟随主题 |

---

接下来：[拆解：陶瓦联机插件](/cookbook/terracotta-plugin)。
