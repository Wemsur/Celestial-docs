# 更新检查

`checkUpdate` 让启动器能告诉用户「你装的这些内容有新版本了」。

```ts
async checkUpdate(items: UpdateQueryItem[]): Promise<UpdateResult[]>
```

**这是可选的。** 不实现、或者声明 `update_check: false`，你的内容就只是不参与更新检查——不影响其他功能。

## 传入什么

启动器把**当前实例里装的、来自你的源的内容**批量传给你：

```ts
{
	id: string // 你给的项目 id
	contentType: ContentType
	currentVersionId?: string // 当前装的是哪个版本（安装时你给的）
	gameVersion?: string // 这个实例的 MC 版本
	loader?: string // 这个实例的加载器
	installRule?: Record<string, unknown> // 安装时你给的规则，原样带回
}[]
```

## 返回什么

```ts
{
	id: string // 对应传入的 id
	latestVersionId?: string // 更新的版本，没有更新就不填
	latestVersionName?: string // 显示用
}[]
```

**没有更新的条目也要回一个 `{ id }`**（不带 `latestVersionId`）——启动器靠返回的数组来匹配，缺了会让它对不上。

## 基本实现

```ts
api.register({
	async checkUpdate(items: UpdateQueryItem[]): Promise<UpdateResult[]> {
		// 批量查：一次请求拿到所有项目的最新版本
		const ids = items.map((item) => item.id)
		const latest = await get<any>(`/latest?ids=${ids.join(',')}`)

		return items.map((item) => {
			const newest = latest[item.id]
			if (!newest) return { id: item.id } // 查不到，当作没有更新

			// 当前已经是最新的
			if (item.currentVersionId === String(newest.version_id)) {
				return { id: item.id }
			}

			return {
				id: item.id,
				latestVersionId: String(newest.version_id),
				latestVersionName: newest.version_name,
			}
		})
	},
})
```

## 判断「有没有更新」

启动器**不做版本比较**——它只看你返回了什么。所以判断逻辑在你这里。

最常见的做法是比 id：

```ts
if (item.currentVersionId === String(newest.id)) return { id: item.id } // 相同，没更新
```

但有时你需要比版本号（比如站点每个版本有独立 id，你想按语义化版本判断）：

```ts
import { compare } from 'semver' // 或者自己写

if (item.currentVersionId && compare(newest.version_number, currentNumber) <= 0) {
	return { id: item.id }
}
```

::: warning `currentVersionId` 可能是 undefined
如果用户是**手动装的文件**（不是通过你的源装的），或者内容是在 `update_check` 之前就装好的，`currentVersionId` 会是 `undefined`。

这时通常应该**当作「有更新」**，让用户能把它升到正式版本；或者当作「不知道」，不回更新。两种都合理，按你的源的情况定。
:::

## `installRule` 是什么

安装时，如果你给过一些「我是按什么规则挑的文件」的信息，启动器会**原样带回来**。

官方的 GitHub 源就用了这个：它的手动条目可以配置「资产匹配正则」，安装时把那个正则放在 `installRule` 里。更新检查时，源就用同一个正则去新 Release 里挑文件——否则会挑到一个和当初装的不一样的文件。

```ts
// 安装时（概念上）
// installRule 里带上用户配置的规则，启动器存起来

// 更新检查时
async checkUpdate(items) {
	return items.map((item) => {
		const rule = item.installRule?.assetPattern // 当初那个正则
		// 用同一个 rule 去新 Release 里挑文件
	})
}
```

如果你的源不存在「同一条目可能对应多个文件」的情况，可以完全忽略 `installRule`。

## 什么时候被调用

- 用户在实例的「内容」页点「检查更新」时。
- 启动器**不会**自动频繁调用——这是个用户主动触发的动作。

所以不用担心性能，但**还是要用批量接口**：一个实例可能装了几百个来自你的源的内容，逐个请求会很慢。

## 失败的后果

`checkUpdate` 抛错时，这个源的更新检查显示为失败，其他源照常。所以错误信息要能读懂：

```ts
if (!response.ok) {
	throw new Error(`示例站返回 ${response.status}`)
}
```

## 声明 `update_check: true` 但不想实现？

那就别声明。声明了却返回空数组是合法的，但等于浪费了一次调用——不如直接 `false`，启动器就不会调用你。

## 常见错误

| 现象 | 原因 |
|---|---|
| 所有内容都显示「有更新」 | 判断逻辑写反了，或者没比较 `currentVersionId` |
| 有更新但提示不了 | 返回的数组漏了某些 `id` |
| 更新装上的文件不对 | 没利用 `installRule` 保持挑文件规则一致 |
| 检查更新很慢 | 逐个请求而不是批量 |

---

接下来：[多语言](/source/i18n)。
