# 拆解：像素茶艺地图源

[celestial-content-pixelmap](https://github.com/Wemsur/celestial-content-pixelmap) 把像素茶艺地图站（`goto.pixelmap.cc`）的地图接进了启动器。

它是最简单的**真实**内容源——一个干净的小 JSON API，278 行。但里面有几处值得学的处理。

## 它解决什么问题

站点提供 Minecraft **地图**（存档）。用户能浏览、搜索、看到详情、下载。

和大多数站不同的地方：

- 站点**没有版本概念**——一张地图就是一个 zip，没有多个版本可选。
- 站点**没有下载计数**——只有浏览量。
- 正文是**自定义的 Markdown + BBCode 方言**。
- 有些条目（公告、专题）**根本没有下载**。

## manifest 的取舍

```json
{
	"id": "pixelmap",
	"name": "像素茶艺地图站",
	"version": "0.1.0",
	"icon": "icon.png",
	"color": "#9c7440",
	"detail_format": "markdown",
	"api_version": 1,
	"entry": "dist/index.js",
	"content_types": ["world"],
	"capabilities": {
		"search": true,
		"browse": true,
		"detail": true,
		"versions": false,
		"resolve_download": true,
		"update_check": false
	},
	"hosts": ["goto.pixelmap.cc", "oss.pixelmap.cc"],
	"settings": [
		{
			"key": "hideNotDownloadable",
			"label": "隐藏不可下载的条目",
			"description": "站点会把公告和专题置顶，这些没有下载文件。默认隐藏，让列表只剩能装的地图。",
			"type": "toggle",
			"default": "true"
		}
	]
}
```

### `content_types: ["world"]`

地图是**世界**。这意味着启动器会把它解压进实例的 `saves/`，而且**永不覆盖**——每次都建新副本。

插件不需要做任何事来实现这一点，但 manifest 里声明对了类型是前提。

### `versions: false` 和 `update_check: false`

::: tip 声明 `false` 而不是假装支持
站点没有版本列表，所以 `versions: false`——版本标签页不显示。

地图装了就装了，站点也不提供「新版本」的概念，所以 `update_check: false`。

**这是正确做法。** 声明了却返回空数组，等于浪费一次调用，还可能让用户看到空的版本表。
:::

### `hosts` 里为什么有 `oss.pixelmap.cc`

```json
"hosts": ["goto.pixelmap.cc", "oss.pixelmap.cc"]
```

`goto.pixelmap.cc` 是 API。`oss.pixelmap.cc` 是**图片 CDN**——详情页正文里的图片来自它。

::: warning 图片域名也要写进 hosts
不写的话，启动器的通用图片代理会把图片转发到 `wsrv.nl` 去取，而像素茶艺的 CDN 防盗链，取不到——**详情页的图会全部裂开**。

这是内容源很容易踩的坑：API 域名记得加，图片域名忘了加。
:::

## 关键代码

### 站点的排序参数和启动器的不是一回事

```ts
/** The site's own sort key, for the orders it actually implements. */
function siteSort(sort: ContentQuery['sort']): string | undefined {
	if (sort === 'downloads') return 'views'
	if (sort === 'newest' || sort === 'updated') return 'updated'
	return undefined
}
```

启动器的排序有五种（`relevance` / `downloads` / `follows` / `newest` / `updated`），站点只认 `views` 和 `updated`。

所以做一个**映射**，认不出的返回 `undefined`（不传这个参数，用站点默认排序）。

::: tip 映射而不是硬套
别直接把 `request.sort` 传给站点——`'downloads'` 对像素茶艺来说是无效参数，可能被忽略也可能报错。映射一下，语义才对得上。

注意站点没有「下载量」这个概念，用浏览量 `views` 顶上——这正是下面 `downloads: post.views` 做的事。
:::

### `relevance` 的两种含义

```ts
const sort = request.sort === 'relevance' && !request.query?.trim()
	? 'views'
	: siteSort(request.sort)
```

回忆一下：启动器在**搜索词为空**时会把 `relevance` 当 `downloads` 处理。

所以插件这里也做同样的事：**没有搜索词时**，用站点的 `views` 排序（按热度）；有搜索词时，不传排序参数（让站点按相关度排）。

### 下载量用浏览量顶上，并且如实标注

```ts
function toCard(post: PixelmapPost, contentType: string): ContentCard {
	const tags = (post.categories ?? []).map((category) => category.name)
	if (!post.allow_download) tags.push('无下载')
	tags.push(`${post.views} 次浏览`)

	return {
		// ...
		downloads: post.views,
		follows: post.likes,
		tags,
	}
}
```

站点没有下载计数。这里做了两件事：

1. **`downloads: post.views`** —— 用浏览量当「热度」参与排序。这是合理的，因为 `downloads` 排序问的本来就是「这个内容有多热门」。
2. **在标签里写上「N 次浏览」** —— 让用户知道这个数字**不是**下载量。

::: tip 别假装
如果站点没有某个数字，用别的数字顶上时**要告诉用户**。直接填 `downloads` 而不说明，用户会以为真的有 3 万次下载。

官方注释写得很清楚：*putting the real figure on the card keeps it honest*。
:::

### 用标签传递额外状态

```ts
if (!post.allow_download) tags.push('无下载')
```

站点上有一些条目作者**没开放下载**。插件在卡片上打一个「无下载」标签，用户一眼就知道为什么装不了。

这比让用户点进详情、点安装、再看到报错好得多。

### 正文的方言转换

站点的编辑器输出的是 **Markdown + 两个自定义 BBCode 标签**。标准的 Markdown 渲染器会把 `[color:#e5daac]文字[/color]` 原样显示成一串字符。

```ts
function toMarkdown(body: string | undefined): string | undefined {
	if (!body) return undefined
	return body
		.replace(
			/\[color[:=]([#a-zA-Z0-9]+)\]([\s\S]*?)\[\/color\]/g,
			(_match, color: string, text: string) => `<font color="${color}">${text}</font>`,
		)
		.replace(
			/\[bili\]\s*(BV[0-9A-Za-z]+)\s*\[\/bili\]/g,
			(_match, videoId: string) => `[${videoId}](https://www.bilibili.com/video/${videoId})`,
		)
}
```

两处转换：

- `[color:#xxx]文字[/color]` → `<font color="#xxx">文字</font>`。启动器的 Markdown 渲染器**保留了 `font` 标签和它的 `color` 属性**，所以站点编辑器的颜色能原样保留。
- `[bili]BVxxx[/bili]` → 一个普通的 Markdown 链接，渲染成可点的链接而不是一串标签。

::: warning 转换后仍是 Markdown，不是 HTML
注意这里把 BBCode 转成了 `<font>` **HTML 标签**——但它是**在 Markdown 字符串里**的。启动器渲染 Markdown 时，内联 HTML 会被消毒后保留。

不要试图在插件里生成完整 HTML——启动器不会原样信任它。
:::

### 画廊从正文里提取

```ts
function galleryOf(post: PixelmapPost): { url: string }[] {
	const urls: string[] = []
	if (post.cover_image_url) urls.push(post.cover_image_url)
	for (const match of (post.content_md ?? '').matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
		urls.push(match[1])
	}
	return [...new Set(urls)].map((url) => ({ url }))
}
```

站点**没有画廊字段**。但地图作者的正文里全是自己截的图——那些就是画廊。

所以插件用正则把正文里的 Markdown 图片挖出来，拼成 `gallery`。封面图经常在正文里重复出现，所以用 `Set` 去重。

::: tip 从现有数据里凑出缺的字段
不是所有站点都有你想要的结构化字段。**看看现有数据里能不能凑出来**——正文里的图片就是画廊，README 就是简介。

这比让详情页空着好。
:::

### 文件名的处理

```ts
async resolveDownload(id: string): Promise<DownloadDescriptor> {
	const payload = await get<{ post: PixelmapPost }>(`/maps/${encodeURIComponent(id)}`)
	const post = payload.post
	if (!post.allow_download || !post.download_url) {
		throw new Error(`「${post.title}」的作者没有开放下载`)
	}

	return {
		url: post.download_url,
		fileName: `${safeFileName(post.title)}.zip`,
	}
}
```

站点的下载 URL 结尾是**存储键**而不是名字：

```
1789268194244403449_RoastLamb.zip
```

所以插件用地图标题当文件名。为什么重要？因为**启动器用文件名给世界存档目录命名**——用户看到的是 `RoastLamb` 还是 `1789268194244403449`，差别很大。

`safeFileName` 把文件名里不能有的字符（`\ / : * ? " < > |`）换成 `-`：

```ts
function safeFileName(title: string): string {
	const cleaned = title
		.replace(/[\\/:*?"<>|]/g, '-')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\.+$/, '')
	return cleaned || '地图'
}
```

最后那个 `|| '地图'` 是兜底——标题如果全是非法字符，清完就空了，得有个名字。

### 筛选：自己过滤而不是依赖站点的参数

```ts
const selected = selectedCategories(request)
let items = (page.items ?? [])
	.filter((post) => (hidden ? post.allow_download : true))
	.filter((post) =>
		selected.every((id) => (post.categories ?? []).some((category) => category.id === id)),
	)
	.map((post) => toCard(post, request.contentType))
```

站点的列表 API 确实有一个 `category` 参数，但**它接受的是分类名，而名字的确切形状不由这个插件控制**（可能带空格、可能本地化）。所以插件不依赖它，而是：

1. 每条数据自带它的分类列表（`post.categories`）。
2. 在本地按用户勾选的分类 id 过滤。
3. `selected.every(...)` —— 用户勾了多个分类时，条目要**同时属于每一个**。

::: tip 本地过滤 vs 服务端过滤
**能用服务端参数就用服务端的**（分页才对得齐）。但如果那个参数的语义不明确或不受你控制，**本地过滤**是更可靠的选择——代价是每页实际显示的条数可能少于 `limit`。

这里的取舍是：站点每页数据自带分类，本地过滤足够便宜，而站点参数的语义不可靠。
:::

### 分页的 `total` 要用站点的值

```ts
// `page.total` is the site's count for the whole query, which is what the pager
// needs to offer every page. Reporting the post-filter length of one page
// instead would make the list look one page long and strand the rest.
return { items, total: page.total ?? items.length }
```

这里有个微妙但重要的点：

- `items` 是**本地过滤后**的当前页条目（可能变少了）。
- `total` 用的是**站点给的整个查询的总数**（过滤前）。

为什么？因为 `total` 是给**分页器**用的——它要知道「一共有多少条，能翻几页」。如果填 `items.length`，分页器会以为总共就这一页。

代价是总数略微偏大（因为没算本地过滤掉的），但注释里说明了：被过滤掉的置顶公告很少，这点误差无所谓。

### `filters` 只取地图分类

```ts
async filters(): Promise<ContentFilterGroup[]> {
	const categories = await get<PixelmapCategory[]>('/categories')
	const options: ContentFilterOption[] = (categories ?? [])
		.filter((category) => category.type === 'map' || category.type === 'both')
		.map((category) => ({ id: category.id, label: category.name }))
	if (options.length === 0) return []
	return [{ id: 'category', header: 'categories', options }]
}
```

站点的分类分三种类型：`map`（地图）、`tutorial`（教程）、`both`（都是）。这个源只列地图，所以只取 `map` 和 `both` 的。

**`header: 'categories'`** —— 用内置的「分类」分组名，这样它和 Modrinth 的分类**合并成一个侧边栏分组**，而不是多出一个同名的组。

## 小结：这篇教了什么

| 技巧 | 用在什么场合 |
|---|---|
| 映射排序参数 | 站点的排序词和启动器的不一样 |
| 用别的数字顶替 | 站点没有下载量，用浏览量，但要标注 |
| 用标签传递状态 | 「无下载」这类信息 |
| 正文方言转换 | 站点用 BBCode 或自定义语法 |
| 从正文挖画廊 | 站点没有 gallery 字段 |
| 文件名清洗 | URL 结尾是存储键 |
| 本地过滤 | 站点参数语义不可靠 |
| `total` 用站点值 | 本地过滤后仍要正确分页 |
| `header: 'categories'` | 和内置分组融合 |

---

接下来：[拆解：MC百科源](/cookbook/mcmod-source)。
