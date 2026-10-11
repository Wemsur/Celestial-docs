# 最小内容源

这是能装进启动器、能搜索、能安装的**最小**内容源。整个插件就是两个文件。

它不是「玩具」——把它换成一个真实的 API 就是可用的插件。官方的像素茶艺源就是在这个形状上加了些东西。

## 完整代码

### `manifest.json`

```json
{
	"id": "example",
	"name": "示例内容站",
	"version": "0.1.0",
	"description": "示例站的模组。",
	"author": "你的名字",
	"icon": "icon.png",
	"color": "#4a90d9",
	"detail_format": "markdown",
	"api_version": 1,
	"entry": "dist/index.js",
	"content_types": ["mod"],
	"capabilities": {
		"search": true,
		"browse": true,
		"detail": true,
		"versions": false,
		"resolve_download": true,
		"update_check": false
	},
	"hosts": ["example.com"]
}
```

### `src/index.ts`

```ts
import type {
	ContentCard,
	ContentPage,
	ContentProject,
	ContentQuery,
	ContentSourceApi,
	DownloadDescriptor,
} from '@celestial/content-source'

export async function activate(api: ContentSourceApi) {
	async function get<T>(path: string): Promise<T> {
		const response = await api.net.fetch(`https://example.com/api${path}`, {
			headers: { accept: 'application/json' },
		})
		if (!response.ok) {
			throw new Error(`示例站 ${response.status} ${path}`)
		}
		return JSON.parse(response.body) as T
	}

	function toCard(item: any, contentType: string): ContentCard {
		return {
			sourceId: api.source.id,
			id: String(item.id),
			contentType: contentType as ContentCard['contentType'],
			name: item.title,
			summary: item.description,
			iconUrl: item.icon,
			downloads: item.views,
			publishedAt: item.created_at,
		}
	}

	async function list(request: ContentQuery): Promise<ContentPage> {
		const params = new URLSearchParams({
			page: String(request.page),
			limit: String(request.limit),
		})
		if (request.query?.trim()) params.set('search', request.query.trim())

		const page = await get<any>(`/items?${params}`)
		return {
			items: (page.items ?? []).map((item: any) => toCard(item, request.contentType)),
			total: page.total ?? 0,
		}
	}

	api.register({
		search: list,
		browse: list,

		async detail(id: string, contentType: string): Promise<ContentProject> {
			const item = await get<any>(`/items/${encodeURIComponent(id)}`)
			return {
				...toCard(item, contentType),
				body: item.body_markdown,
				links: [{ label: '在示例站查看', url: item.url }],
			}
		},

		async resolveDownload(id: string): Promise<DownloadDescriptor> {
			const item = await get<any>(`/items/${encodeURIComponent(id)}`)
			return {
				url: item.download_url,
				fileName: `${item.slug}.jar`,
			}
		},
	})
}
```

## 逐段讲解

### 为什么 `search` 和 `browse` 是同一个函数

```ts
search: list,
browse: list,
```

站点的 API 把「空查询」当浏览处理——`/items?search=` 和 `/items` 返回一样的东西。所以两个能力共用一个实现。

::: tip 这是很常见的做法
大部分内容站的 API 都是这样。只有当站点对「浏览」有**不同的接口**（比如 `/trending` vs `/search`）时才需要分开写。
:::

注意：**不要**写 `browse() { return this.search(request) }`——`this` 在对象字面量里容易出错。抽成独立函数最稳。

### `toCard` 被三处复用

```ts
function toCard(item: any, contentType: string): ContentCard { ... }
```

`list` 和 `detail` 都用它。这是标准做法——详情页的卡片信息（名字、图标、下载量）和列表页是一样的。

**关键：`contentType` 参数，不是写死的 `'mod'`。**

```ts
// ✅ 用传进来的类型
toCard(item, request.contentType)

// ❌ 写死
toCard(item, 'mod')
```

写死了的话，将来你支持第二种内容类型时，那个标签页里的卡片会被标成错误的类型。

### `resolveDownload` 只返回地址

```ts
async resolveDownload(id: string): Promise<DownloadDescriptor> {
	const item = await get<any>(`/items/${id}`)
	return { url: item.download_url, fileName: `${item.slug}.jar` }
}
```

注意它**没有下载任何东西**。它只是又查了一次 API，拿到 URL，返回给启动器。启动器负责下载、校验、决定装到哪。

::: tip 为什么又查一次？
因为 `resolveDownload` 和 `detail` 是分开调用的——启动器不保证先调 `detail`。所以每个方法都要能独立工作。

如果你担心重复请求，可以在插件里加个简单的缓存（用 `api.storage`，或者一个模块级的 `Map`）。
:::

### `fileName` 的重要性

```ts
fileName: `${item.slug}.jar`
```

站点的下载 URL 可能长这样：`https://example.com/download/12345`——最后一段是 `12345`。不填 `fileName` 的话，用户装上的文件就叫 `12345`，在模组列表里完全看不出是什么。

**总是填一个人类可读的文件名。**

### `hosts` 只写需要的

```json
"hosts": ["example.com"]
```

一个域名就够，因为所有请求都走 `example.com/api`。如果下载地址在别的域名（CDN），那个也要加进去：

```json
"hosts": ["example.com", "cdn.example.com"]
```

::: warning 别忘了下载的域名
这是最常见的第一个 bug：API 能通（`example.com` 在 hosts 里），但点安装失败，因为下载地址是 `cdn.example.com`——没写进 hosts。

**测试方法**：在启动器里真的装一次，看日志里有没有域名被拒。
:::

## 怎么扩展它

这个骨架加上几样东西就是真实插件了：

| 想加的能力 | 怎么做 |
|---|---|
| 版本列表 | 实现 `versions()`，`capabilities.versions: true` |
| 侧边栏筛选 | 实现 `filters()`（不需要声明） |
| 整合包 | 实现 `resolveModpack()`，`content_types` 加 `modpack` |
| 更新检查 | 实现 `checkUpdate()`，`capabilities.update_check: true` |
| 多语言标签 | 见[多语言](/source/i18n) |

---

接下来看真实的：[拆解：像素茶艺地图源](/cookbook/pixelmap-source)。
