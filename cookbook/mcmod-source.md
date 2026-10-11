# 拆解：MC百科源

[celestial-content-mcmod](https://github.com/Wemsur/celestial-content-mcmod) 把 MC百科（`mcmod.cn`）的中文模组和整合包接进了启动器。

它是最能说明「**没有 API 怎么办**」的一个源——整个站点是服务端渲染的 HTML，所有数据都是从页面里解析出来的。707 行，也是「**不能安装的源**」的标准范例。

## 它解决什么问题

MC百科是一个中文 Minecraft 维基：收录模组和整合包，每个有中文名、中文简介、长正文，还有支持的游戏版本和加载器。

**但它不能安装。** MC百科自己的下载要过人机验证（`/frame/class/DownloadCaptcha/`），没法在插件里走通。

所以这个源的定位是：**浏览和检索**——让中文用户在启动器里搜到中文内容、看到中文简介，然后点链接去站点下载。

## manifest 的取舍

```json
{
	"id": "mcmod",
	"name": "MC百科",
	"version": "0.1.0",
	"icon": "icon.png",
	"color": "#86c155",
	"detail_format": "markdown",
	"api_version": 1,
	"entry": "dist/index.js",
	"content_types": ["mod", "modpack"],
	"capabilities": {
		"search": true,
		"browse": true,
		"detail": true,
		"versions": false,
		"resolve_download": false,
		"update_check": false
	},
	"hosts": ["www.mcmod.cn", "search.mcmod.cn", "i.mcmod.cn"]
}
```

### `resolve_download: false`

::: tip 这是「不能安装的源」的正确做法
站点下载要过人机验证，所以这个源**不提供安装**。

`resolve_download: false` 之后，启动器的安装按钮**变成不可用**（而不是点了报错）。用户看到的是一个「在 MC百科查看」的链接。

**不要**声明 `resolve_download: true` 然后抛错——那是 bug，不是设计。
:::

### 三个域名

```json
"hosts": ["www.mcmod.cn", "search.mcmod.cn", "i.mcmod.cn"]
```

- `www.mcmod.cn` —— 主站，模组/整合包的列表页和详情页。
- `search.mcmod.cn` —— **搜索主机**。整合包的列表页**不支持关键词**，所以整合包搜索必须去这里。
- `i.mcmod.cn` —— **图片 CDN**。详情页的图来自它。

::: warning 图片域名是最容易漏的
`i.mcmod.cn` 如果不写，详情页的图会全部裂开（被启动器的图片代理转发到 `wsrv.nl`，站点防盗链取不到）。
:::

### `versions: false`

MC百科的「版本」概念和启动器的不一样——它列出的是**这个模组支持哪些游戏版本**，不是一个可下载的版本列表。所以版本表不显示，而是把游戏版本和加载器信息放在卡片的 `gameVersions` / `loaders` 字段里，用于**安装时的兼容筛选**（虽然这个源不安装，但用户还能看到它支持什么）。

## 关键代码

### 用 `DOMParser` 解析 HTML

这是「没有 API」的源的核心工具：

```ts
async function fetchDoc(url: string): Promise<Document> {
	const response = await api.net.fetch(url, {
		headers: { accept: 'text/html,application/xhtml+xml' },
	})
	if (!response.ok) {
		throw new Error(`MC百科 ${response.status} ${url}`)
	}
	return new DOMParser().parseFromString(response.body, 'text/html')
}
```

::: tip `DOMParser` 在 webview 里是可用的
插件跑在启动器的 webview 里，所以浏览器原生的 `DOMParser` 可以直接用。不用引第三方 HTML 解析库——那些库会进构建产物，而 `DOMParser` 是免费的。
:::

解析出来的 `Document` 和浏览器里的 DOM 一样，可以 `querySelector`、`querySelectorAll`。

### 部分失败要用部分结果

```ts
async function fetchDocs(urls: string[]): Promise<Document[]> {
	const settled = await Promise.allSettled(urls.map((url) => fetchDoc(url)))
	const docs: Document[] = []
	const failures: string[] = []
	for (const result of settled) {
		if (result.status === 'fulfilled') docs.push(result.value)
		else failures.push(result.reason instanceof Error ? result.reason.message : String(result.reason))
	}
	if (docs.length === 0) {
		throw new Error(failures[0] ?? 'MC百科 请求失败')
	}
	if (failures.length > 0) {
		api.log(`部分请求失败，已用其余结果继续：${failures.join('；')}`)
	}
	return docs
}
```

这段是**很值得学的模式**：

- `Promise.allSettled` 而不是 `Promise.all` —— 一个失败不影响其他的。
- **全部失败**才抛错——这样启动器会把源标记为失败，而不是静默显示空列表。
- **部分失败**只记日志，用其余结果继续。

为什么需要？因为站点的筛选是**单选**的（见下），勾三个分类要发三个请求。三个请求里挂一个是很常见的事（站点慢、429 限流），不应该因此丢掉另外两个的结果。

::: warning 不要重试
注释里说得很清楚：*Nothing is retried: the site's limiter is not something to hammer at*。

启动器自己会重新请求。插件里加重试风暴只会让站点更慢、更容易封你。
:::

### 站点的筛选是「单选」，所以要发多次请求

这是这个源最特别的地方。站点的筛选块是**单选**的：

```
?category=1&category=2   ← 只保留其中一个！
```

所以用户勾了三个分类时，**不能**一次请求带三个值。要**每个分类请求一次，然后合并**：

```ts
async function browse(request: ContentQuery): Promise<ContentPage> {
	const categories = requestedCategories(request)
	// 没有勾选时也要请求一次（不带 category 参数）
	const wanted = categories.length > 0 ? categories : [undefined]
	const docs = await fetchDocs(wanted.map((categoryId) => listingUrl(request, categoryId)))
	return collect(docs, request.contentType)
}
```

```ts
/** A listing page for one category, one page, and whatever else the request asks. */
function listingUrl(request: ContentQuery, categoryId: string | undefined): string {
	const params = listingParams(request)
	if (categoryId) params.set('category', categoryId)
	params.set('page', String(request.page))
	return `${sectionOf(request.contentType).listing}?${params}`
}
```

::: tip `[undefined]` 这个技巧
没有勾选任何分类时，`wanted` 是 `[undefined]`——一个长度为 1、元素为 `undefined` 的数组。

这样 `wanted.map(...)` 会走一次，`listingUrl(request, undefined)` 里 `if (categoryId)` 为假，不设 `category` 参数——正好是「浏览全部」。

用数组统一了「勾了」和「没勾」两种情况，不用写两个分支。
:::

### 合并多个页面的结果

```ts
function collect(docs: Document[], contentType: string): ContentPage { ... }
```

`collect` 把多个 `Document` 的条目合并成一个 `ContentPage`。同一个条目可能在多个分类下都出现，所以合并时要去重。

### 两个分区的结构不同

模组和整合包在站点上是**两个不同的分区**，HTML 结构、加载器编号、甚至搜索行为都不一样：

```ts
function sectionOf(contentType: string): { ... } {
	// 返回这个分区用的：列表页 URL、详情页 URL、加载器编号表、kind
}
```

所以代码里到处是 `sectionOf(request.contentType).kind === 'modpack'` 这样的判断。

::: tip 加载器编号在两个分区里不一样
```ts
const MOD_LOADERS = { forge: '1', fabric: '2', quilt: '11', neoforge: '13', ... }
const MODPACK_LOADERS = { forge: '1', fabric: '2', quilt: '3', ..., neoforge: '7' }
```

**NeoForge 在模组里是 13，在整合包里是 7。** 站点自己的编号，两个分区各编各的。

这类「站点内部编号」是写 HTML 解析型插件时最烦的部分——只能对着页面一个个确认。
:::

### 整合包搜索要走另一个主机

```ts
if (sectionOf(request.contentType).kind === 'modpack') {
	// The modpack listing ignores `key` outright — the same query with and
	// without it answers identically — so a modpack search goes to the site's
	// search host
	const url = `${SEARCH_SITE}/s?key=${encodeURIComponent(needle)}&filter=2&page=${request.page}`
	const doc = await fetchDoc(url)
	// ...
}
```

站点的**整合包列表页完全忽略 `key` 参数**——加不加它返回一样的东西（插件作者是对着页面验证过的）。

所以整合包搜索只能去站点的搜索主机。代价是：那个主机的整合包结果**没有封面图、没有分类**。

::: tip 现实里的妥协
这是典型的「站点不给力，插件只能将就」。注释里说明了代价：`search.mcmod.cn` 的结果没法按分类筛选。

**诚实地写下这些限制**比假装支持要好。用户在整合包搜索里看到的条目没有封面——这是站点的限制，不是插件的 bug。
:::

### 详情页：拼出正文和链接

```ts
async function detail(id: string, contentType: string): Promise<ContentProject> {
	// 从详情页 HTML 里解析出：
	// - 简介（openingParagraph）
	// - 支持的版本和加载器（gameVersionsAndLoaders）
	// - 标签（tagsOf）
	// - 作者（authorOf）
	// - 正文（descriptionOf）
	// - 站外链接（linksOf）
}
```

因为不能安装，**`links` 是用户唯一的出口**：

```ts
links: [{ label: '在 MC百科查看', url: `${SITE}/class/${id}.html` }]
```

用户在启动器里看完中文简介，点这个链接去站点下载。

### 版本和加载器的配对

```ts
/**
 * The version block is one flat run of alternating children — a loader title
 * (`Fabric (共 20 个版本):`) then the versions that loader runs — so the two are
 * paired by walking the block rather than by nesting.
 */
function gameVersionsAndLoaders(doc: Document): { ... }
```

站点的 HTML 里，版本块的 DOM 是**扁平的交替结构**：

```
<div>Fabric (共 20 个版本):</div>
<div>1.20.1</div>
<div>1.20.2</div>
<div>Forge (共 15 个版本):</div>
<div>1.20.1</div>
...
```

不是嵌套的。所以不能简单地 `querySelector`，要**按顺序遍历，遇到加载器标题就切换当前加载器**。

::: warning HTML 解析型插件的日常
站点不会给你结构化数据。DOM 是给人看的布局，不是给机器读的。

**把这种「扁平交替」的解析逻辑单独写成一个具名函数**（就像这里），而不是塞在 `detail` 里——否则它会变成一团没法维护的正则和 `querySelector`。
:::

### 缓存分类列表

```ts
const categoryCache = new Map<string, ContentFilterOption[]>()
```

分类列表在插件的**模块级变量**里缓存。因为 `filters()` 会被反复调用（用户每次操作都可能触发），而分类几乎不变。

::: tip 缓存放哪
- **模块级 `Map`** —— 生命周期是「这个源被加载期间」，适合分类这种变化极慢的东西。
- **`api.storage`** —— 跨启动保留，适合更贵的数据。

分类用模块级 `Map` 就够了——重启启动器重新拉一次无所谓。
:::

## 小结：这篇教了什么

| 技巧 | 用在什么场合 |
|---|---|
| `DOMParser` 解析 HTML | 站点没有 API |
| `Promise.allSettled` + 部分结果 | 多请求，一个失败不该丢全部 |
| 单选筛选发多次请求再合并 | 站点筛选是单选的 |
| `[undefined]` 统一空/非空 | 避免写两个分支 |
| 不重试 | 站点有限流，重试只会更糟 |
| `links` 作为出口 | 不能安装的源 |
| 扁平 DOM 的遍历配对 | HTML 结构不嵌套 |
| 模块级缓存 | 变化极慢的数据 |
| 诚实记录限制 | 站点不给力时的妥协 |

---

接下来：[拆解：GitHub Releases 源](/cookbook/github-source)。
