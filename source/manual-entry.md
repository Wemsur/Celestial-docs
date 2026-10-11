# 手动条目

有些源**没有可浏览的内容目录**——最典型的是 GitHub：它没有「所有模组」这样一个列表，你得知道仓库地址才能找到东西。

这种源用 `manual_entry`：让用户**手工添加条目**，启动器生成表单，你从自己的存储里读回来。

## 什么时候用

| 场景 | 用 manual_entry？ |
|---|---|
| 站点有搜索/分类，能列出内容 | ❌ 正常写 `search` / `browse` |
| GitHub 仓库、单个下载链接 | ✅ |
| 用户想装一个「不在任何站上的」文件 | ✅ |
| 站点 API 有内容列表但你没有浏览接口 | 通常还是写 `browse`，别让用户手输 |

官方的 GitHub 源就是标准例子：它 `search: false`、`browse: true`（但浏览的是用户自己加过的条目），条目全部由用户手工添加。

## 声明字段

```json
"manual_entry": [
	{
		"key": "repo",
		"label": "仓库（owner/name）",
		"placeholder": "FabricMC/fabric-api",
		"pattern": "^[^/\\s]+/[^/\\s]+$",
		"required": true
	},
	{
		"key": "type",
		"label": "内容类型",
		"required": true,
		"options": [
			{ "value": "mod", "label": "模组" },
			{ "value": "resourcepack", "label": "资源包" }
		]
	},
	{
		"key": "name",
		"label": "名称（可选）",
		"description": "显示在列表里的名字，留空用仓库名。"
	}
]
```

| 字段 | 说明 |
|---|---|
| `key` | 存储时用的键。读回来时用它取值 |
| `label` | 表单上显示的名称 |
| `description` / `placeholder` | 可选的提示 |
| `pattern` | 正则，不匹配时表单给出提示 |
| `options` | **有它时渲染成下拉框**，没有则渲染成输入框 |
| `required` | 是否必填 |

::: warning `pattern` 只是提示，不是校验
`pattern` 不匹配时表单会给出提示，但**用户仍然能提交**。真正的把关要写在你的代码里：

```ts
const entries = parseEntries()
const valid = entries.filter((entry) => /^[^/\s]+\/[^/\s]+$/.test(entry.repo))
```
:::

## 带上 `options` 的那一个字段

如果源服务多种内容类型，**必须有一个带 `options` 的字段让用户选类型**——否则这个条目会出现在**所有**标签页下。

官方 GitHub 源的做法：

```json
{
	"key": "type",
	"label": "内容类型",
	"options": [
		{ "value": "mod", "label": "模组" },
		{ "value": "resourcepack", "label": "资源包" },
		{ "value": "shader", "label": "光影" },
		{ "value": "datapack", "label": "数据包" }
	],
	"required": true
}
```

读回来时按 `type` 过滤：

```ts
async browse(request: ContentQuery): Promise<ContentPage> {
	const entries = await readEntries()
	// 只返回当前标签页对应的类型
	const matching = entries.filter((entry) => entry.type === request.contentType)
	return { items: matching.map((entry) => toCard(entry, request.contentType)), total: matching.length }
}
```

## 读回条目

用户添加的条目存在 `api.storage` 的固定键 **`manualEntries`** 下，是一个 JSON 数组：

```ts
type ManualEntry = {
	repo: string
	type: string
	name?: string
	// ...你声明过的其他 key
}

async function readEntries(): Promise<ManualEntry[]> {
	const raw = await api.storage.get('manualEntries') // JSON 字符串或 null
	if (!raw) return []
	try {
		const parsed = JSON.parse(raw)
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}
```

::: tip 用 SDK 里的常量
SDK 导出了一个类型 `ManualEntriesStorageKey`（值就是 `'manualEntries'`）。用它可以避免拼错：

```ts
import type { ManualEntriesStorageKey } from '@celestial/content-source'
const raw = await api.storage.get('manualEntries' satisfies ManualEntriesStorageKey)
```
:::

## 完整例子

```ts
import type { ContentCard, ContentPage, ContentQuery, ContentSourceApi } from '@celestial/content-source'

type Entry = { repo: string; type: string; name?: string }

export async function activate(api: ContentSourceApi) {
	async function readEntries(): Promise<Entry[]> {
		const raw = await api.storage.get('manualEntries')
		if (!raw) return []
		try {
			const parsed = JSON.parse(raw)
			return Array.isArray(parsed) ? parsed : []
		} catch {
			return []
		}
	}

	api.register({
		// 浏览 = 列出用户加过的、属于当前标签页类型的条目
		async browse(request: ContentQuery): Promise<ContentPage> {
			const entries = (await readEntries()).filter((entry) => entry.type === request.contentType)

			const cards: ContentCard[] = entries.map((entry) => ({
				sourceId: api.source.id,
				id: entry.repo, // 用仓库地址当项目 id
				contentType: request.contentType,
				name: entry.name || entry.repo.split('/')[1],
				summary: entry.repo,
			}))

			return { items: cards, total: cards.length }
		},

		// 详情：去 GitHub 拿仓库信息和 Release
		async detail(id: string, contentType: ContentType) {
			const [owner, name] = id.split('/')
			const repo = await get<any>(`https://api.github.com/repos/${owner}/${name}`)
			const releases = await get<any[]>(`https://api.github.com/repos/${owner}/${name}/releases`)

			return {
				sourceId: api.source.id,
				id,
				contentType,
				name: repo.name,
				summary: repo.description,
				iconUrl: repo.owner.avatar_url,
				body: repo.description,
				links: [{ label: '在 GitHub 查看', url: repo.html_url }],
				versions: releases.map(toVersion),
			}
		},
	})

	api.log('已启动')
}
```

## 用户怎么添加条目

用户在你的源设置里点「添加条目」，启动器弹出表单——**这个表单是启动器生成的，你不需要写任何 UI 代码**。

官方的 GitHub 源在设置里还把「已有条目」放在最上方，下面是占满整行的「添加条目」按钮。这是启动器的行为，你不用管。

## 更新条目

条目变了（用户改了一个），`manualEntries` 整个被替换。所以：

- **不要在 `manualEntries` 里存你自己算出来的数据**——用户改一次就丢了。
- 要缓存什么，用别的键，以 `repo` 之类为索引。

## 常见错误

| 现象 | 原因 |
|---|---|
| 条目出现在所有标签页 | 没有带 `options` 的类型字段，或者 `browse` 里没按类型过滤 |
| 读不到条目 | 键名拼错，必须是 `'manualEntries'` |
| `JSON.parse` 抛错 | 没做 `try/catch`，坏数据会让整个插件崩 |
| 用户改了条目后缓存不对 | 把派生数据也存进了 `manualEntries` |

---

接下来看参考手册，或者去[实例拆解](/cookbook/)看真实插件。
