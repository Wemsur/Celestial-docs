# 搜索与浏览

`search` 和 `browse` 是内容源最常用的两个方法。它们的签名一样，差别只在「有没有搜索词」。

| | 什么时候调用 | `request.query` |
|---|---|---|
| `search` | 用户输入了搜索词 | 有 |
| `browse` | 用户没输入搜索词，只是在浏览 | 空 |

## 请求对象

```ts
async search(request: ContentQuery): Promise<ContentPage>
```

```ts
request = {
	query?: string // 搜索词。browse 时为空或 undefined
	contentType: ContentType // 用户当前在哪个标签页（mod / modpack / ...）
	gameVersion?: string // 用户在侧边栏选的游戏版本
	loader?: string // 用户在侧边栏选的加载器
	sort: ContentSort // 排序方式
	page: number // 从 1 开始
	limit: number // 每页条数
	category?: string // 源自己的分类 id（可选）
	filters?: Record<string, unknown> // 你在 filters() 里声明的组 → 用户勾选的选项
}
```

### `sort` 的取值

```ts
type ContentSort = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'
```

::: tip `relevance` 的行为和你想的可能不同
**搜索词为空时**，启动器会把 `relevance` 当成 `downloads` 处理——它按整体热度排，而不是按你返回的顺序。

**搜索词非空时**，启动器保留你返回的顺序。

所以：你的站点按什么排最合理，就按什么排。搜索时你的顺序会被尊重，浏览时启动器自己会重新排。
:::

### `gameVersion` 和 `loader`

用户在侧边栏选的筛选条件。**如果为空，表示用户没有选，不是「不匹配」**：

```ts
// ✅ 只在用户选了的时候才传给你的 API
const params = new URLSearchParams({
	q: request.query ?? '',
	page: String(request.page),
	limit: String(request.limit),
})
if (request.gameVersion) params.set('gameVersion', request.gameVersion)
if (request.loader) params.set('loader', request.loader)
```

如果站点不支持这些筛选，直接忽略也没问题——只是用户勾了没效果。

## 返回对象

```ts
{
	items: ContentCard[]
	total: number // 总数，用于分页器
}
```

### `ContentCard`

```ts
{
	sourceId: string // 填 api.source.id
	id: string // 你自己的项目 id，之后会传回 detail / versions
	contentType: ContentType
	name: string
	summary?: string
	iconUrl?: string
	author?: string
	downloads?: number // 原始值，启动器会乘上源倍率再排序
	follows?: number
	publishedAt?: string // ISO 8601
	updatedAt?: string
	gameVersions?: string[]
	loaders?: string[]
	tags?: string[] // 显示在卡片上的标签
}
```

### 哪些字段重要

| 字段 | 影响 |
|---|---|
| `id` | **必须有且稳定**。它是你之后收到 `detail(id)` 时的那个 `id` |
| `name` | 卡片标题。**合并重复内容时按名字匹配**（见下） |
| `contentType` | 卡片出现在哪个标签页。用 `request.contentType`，别写死 |
| `downloads` | 排序用。如实填，别放大（启动器会乘倍率） |
| `publishedAt` / `updatedAt` | `newest` / `updated` 排序用。**ISO 8601 格式** |
| `gameVersions` / `loaders` | 安装时用来筛选兼容的实例 |
| `iconUrl` | 卡片的封面图 |

## 完整例子

```ts
async search(request: ContentQuery): Promise<ContentPage> {
	const params = new URLSearchParams({
		q: request.query ?? '',
		page: String(request.page),
		limit: String(request.limit),
	})
	if (request.gameVersion) params.set('game_version', request.gameVersion)
	if (request.loader) params.set('loader', request.loader)

	const page = await get<any>(`/search?${params}`)

	return {
		items: page.hits.map((hit: any) => ({
			sourceId: api.source.id,
			id: String(hit.id),
			contentType: request.contentType,
			name: hit.title,
			summary: hit.description,
			iconUrl: hit.icon_url,
			author: hit.author,
			downloads: hit.download_count,
			publishedAt: hit.published_at, // ISO 8601
			updatedAt: hit.updated_at,
			gameVersions: hit.game_versions,
			loaders: hit.loaders,
			tags: hit.categories?.slice(0, 3),
		})),
		total: page.total,
	}
}
```

`browse` 通常是同一个函数，只是不传搜索词：

```ts
async browse(request: ContentQuery): Promise<ContentPage> {
	return this.search(request) // 站点把「空查询」当浏览处理
}
```

::: warning `this` 在对象字面量里的坑
如果 provider 是对象字面量，`this.search` 只有在调用方用 `provider.browse()` 时才指向 provider。启动器确实是这样调的，但更稳妥的写法是抽出一个普通函数：

```ts
async function queryItems(request: ContentQuery): Promise<ContentPage> {
	/* ... */
}

api.register({
	search: queryItems,
	browse: queryItems,
})
```
:::

## 分页

`request.page` 从 **1** 开始，`request.limit` 是每页条数。

**`total` 要填真实总数**，不是当前页的条数——启动器靠它画分页器：

```ts
return { items: cards, total: page.total_count } // ✅ 总数
return { items: cards, total: cards.length } // ❌ 只有当前页的条数
```

如果站点不返回总数，用「当前页满就是还有更多」的近似：

```ts
const hasMore = cards.length === request.limit
return { items: cards, total: request.page * request.limit + (hasMore ? 1 : 0) }
```

## 内容合并

浏览页会把**所有启用源**的结果合并成一个列表。合并的规则是：

**同类型 + 名字相同（归一化后）** 的内容会被认成同一条，只显示一行。

这解决的是「同一个模组在 Modrinth 和 CurseForge 都有」的情况。合并后：

- 如果其中一个是 Modrinth 的，**那一行显示 Modrinth 的卡片**（图标、名字、计数都更让用户熟悉）。
- 否则选下载量最高的那个源的卡片。
- 详情页会显示所有源提供的版本。

::: tip 你的 `name` 决定会不会被合并
归一化会去掉大小写、空格、标点的差异。`"Sodium"` 和 `"sodium"` 会合并，`"Sodium Extra"` 和 `"Sodium"` 不会。

如果你不希望自己的内容和别人的合并，名字写得独特一点即可——但通常**你希望合并**，那意味着用户在任意一个源里都能找到并安装。
:::

## 源倍率

合并排序时，启动器给你报告的 `downloads` 乘上一个**倍率**：

```
排序用的值 = 你的 downloads × 这个源的倍率
```

倍率由**用户**在设置里调（默认是 1，可调范围有限制）。目的是让一个小站点最好的内容不至于被 Modrinth 的几十万下载淹没。

**你的责任只是如实报告。** 不要自己放大数字——放大了就变成了在骗用户调出来的倍率，而且会让同一内容在多个源之间显示不一致。

## 失败的源不会拖垮整个页面

浏览页会**并行**调用所有启用源的 `search`。如果某个源抛错：

- 那个源的内容不显示。
- 页面顶部显示一条「N 个源加载失败」的提示。
- **其他源照常显示。**

所以你的源抛错只会影响你自己，不会让用户看到白屏。但错误信息会显示给用户，所以**抛出有意义的错误**：

```ts
if (!response.ok) {
	// ✅ 用户看到「示例站返回 503」，能判断是站点的问题
	throw new Error(`示例站返回 ${response.status}`)
}
```

```ts
// ❌ 用户看到「Request failed」，什么也判断不出来
throw new Error('Request failed')
```

---

接下来：[详情页](/source/detail)。
