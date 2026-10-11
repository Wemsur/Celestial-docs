# 详情页

用户点一张卡片进去看到的页面。`detail` 返回的内容决定它长什么样。

```ts
async detail(id: string, contentType: ContentType): Promise<ContentProject>
```

## 返回对象

`ContentProject` 在 `ContentCard` 的基础上加几个字段：

```ts
{
	// ...ContentCard 的所有字段（sourceId、id、name、contentType、iconUrl、...）

	body?: string // 正文
	gallery?: { url: string; title?: string }[] // 画廊
	license?: string // 许可证
	links?: { label: string; url: string }[] // 站外链接
	versions?: ContentVersion[] // 版本列表（也可以只靠 versions() 提供）
}
```

**除了 `id` 和 `name`，其余字段都是可选的。** 页面会按你能提供的降级——没有 `gallery` 就不显示画廊，没有 `body` 就显示一句「这个源没有提供简介」。

## 正文（`body`）

正文的渲染方式由 manifest 的 `detail_format` 决定：

| `detail_format` | `body` 怎么显示 |
|---|---|
| `markdown`（默认） | 按 Markdown 渲染，经过 XSS 消毒 |
| `text` | 按纯文本原样显示，不解释任何格式字符 |

```ts
async detail(id: string): Promise<ContentProject> {
	const item = await get<any>(`/item/${id}`)
	return {
		...toCard(item, 'mod'),
		body: item.body_markdown, // 站点提供的 Markdown 正文
	}
}
```

::: danger 你返回的 HTML 不会原样进入页面
启动器**自己渲染** Markdown，并做 XSS 消毒。所以：

- 你不需要（也不该）自己生成 HTML。
- `<script>`、内联事件、危险属性会被过滤掉。
- 如果你的正文里有站点特有的语法（比如 BBCode、Discourse 方言），要在插件里**先转换成 Markdown**，再返回。官方的像素茶艺源就是这么做的。
:::

### 图片

正文里的 Markdown 图片 `![alt](https://...)` 会被渲染成 `<img>`。

**图片域名受 `hosts` 影响**——这是一个容易踩的坑：

- 图片域名在 `hosts` 里 → 直接加载。
- 图片域名不在 `hosts` 里 → 启动器的通用图片代理会把它转发到第三方图片服务（`wsrv.nl`）去取。

第二条对很多站点的 CDN **不work**（防盗链、需要 Referer 等）。所以：

::: tip 把图片域名也写进 hosts
如果站点的正文里有图片，把那些图片域名也加到 `hosts` 里，它们就能直接加载：

```json
"hosts": ["example.com", "oss.example.com"]
```

官方像素茶艺源的正文图片来自 `oss.pixelmap.cc`，所以它把这个域名也声明了。
:::

如果正文里混了多种图片源，而你不确定全部域名，一个稳妥的做法是**在插件里把图片 URL 改写成你 `hosts` 里的域名**，或者干脆只返回你确认能加载的图片。

## 画廊（`gallery`）

```ts
gallery: [
	{ url: 'https://cdn.example.com/shot1.jpg', title: '主界面' },
	{ url: 'https://cdn.example.com/shot2.jpg', title: '合成表' },
]
```

`title` 可选，显示为图片说明。**画廊图片同样受 `hosts` 影响。**

如果站点没有画廊，或者你拿不到，不填即可——详情页会用 `iconUrl` 作为唯一的图。

## 站外链接（`links`）

```ts
links: [
	{ label: '在示例站查看', url: 'https://example.com/item/123' },
	{ label: '源码', url: 'https://github.com/...' },
]
```

显示为详情页上的一排按钮，点了用系统浏览器打开。**这是「没有 `resolve_download` 的源」给用户的出口**——官方 MC百科源就是这样：

```ts
// mcmod 源：站点下载要过人机验证，所以不给下载地址，给一个站外链接
async detail(id: string): Promise<ContentProject> {
	const item = await get<any>(`/item/${id}`)
	return {
		...toCard(item, 'mod'),
		body: item.body,
		links: [{ label: '在 MC百科查看', url: item.url }],
	}
}
```

## 许可证（`license`）

一个字符串，如 `"MIT"`、`"CC BY-NC-SA 4.0"`。显示在详情页的信息栏里。可选。

## 完整例子

```ts
async detail(id: string, contentType: ContentType): Promise<ContentProject> {
	const item = await get<any>(`/item/${encodeURIComponent(id)}`)

	return {
		sourceId: api.source.id,
		id: String(item.id),
		contentType,
		name: item.title,
		summary: item.description,
		iconUrl: item.icon_url,
		author: item.author,
		downloads: item.download_count,
		publishedAt: item.published_at,

		body: item.body_markdown,
		gallery: (item.screenshots ?? []).map((shot: any) => ({
			url: shot.url,
			title: shot.caption,
		})),
		license: item.license,
		links: [
			{ label: '在示例站查看', url: item.url },
			...(item.source_url ? [{ label: '源码', url: item.source_url }] : []),
		],
	}
}
```

## `contentType` 参数

`detail` 会收到 `contentType`——就是用户从哪个标签页点进来的。**用它，别写死**，因为同一个源可能服务多个类型：

```ts
async detail(id: string, contentType: ContentType): Promise<ContentProject> {
	const item = await get<any>(`/item/${id}`)
	return { ...toCard(item, contentType), body: item.body } // ✅
}
```

## 详情页上还有什么

除了你返回的字段，详情页还会显示启动器自己加的部分：

| 区块 | 内容 | 来源 |
|---|---|---|
| 版本列表 | 版本表格 | 你的 `versions()`，或 `detail` 返回的 `versions` |
| 安装按钮 | 点开选择实例 | 需要 `resolve_download: true` |
| 已安装标记 | 「已安装」 | 启动器自己记录 |
| 源徽章 | 内容来自哪个源 | 你的 `icon` / `color` / `name` |

所以详情页的完整度取决于你提供了多少——提供一个 `body` 和几张 `gallery` 图，页面就已经很完整了。

## 常见错误

| 现象 | 原因 |
|---|---|
| 正文显示成一坨纯文本 | `detail_format` 是 `text`，但站点给的是 Markdown |
| 正文里出现 `[b]标题[/b]` 这种 | 站点是 BBCode/Discourse 方言，需要在插件里先转成 Markdown |
| 图片裂开 | 图片域名不在 `hosts` 里，被代理到 `wsrv.nl` 后取不到 |
| 详情页很空 | `detail` 返回的字段太少，至少给 `body` 和 `links` |

---

接下来：[版本列表](/source/versions)。
