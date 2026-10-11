# 拆解：GitHub Releases 源

[celestial-content-github](https://github.com/Wemsur/celestial-content-github) 把 **GitHub 仓库的 Release** 当作可安装内容。

它是最复杂的内容源之一，因为它回答的是一个特殊问题：**一个没有内容目录的站点，怎么让用户"浏览"？**

## 它解决什么问题

GitHub 上没有「所有模组」这样一个列表。你要先知道仓库地址，才能找到东西。

所以这个源的形态和别的完全不同：

- **`search: false`** —— 没有可搜索的目录。
- **`browse: true`** —— 但"浏览"列的是**用户自己添加过的仓库**。
- 条目通过**手动条目**（`manual_entry`）添加。

这是内容源的一个正当形态：**一个"我的收藏夹"式的源**。

## manifest 的取舍

```json
{
	"id": "github",
	"name": "GitHub Releases",
	"version": "0.1.0",
	"icon": "icon.svg",
	"color": "#c9d1d9",
	"detail_format": "markdown",
	"api_version": 1,
	"entry": "dist/index.js",
	"content_types": ["mod", "resourcepack", "shader", "datapack"],
	"capabilities": {
		"search": false,
		"browse": true,
		"detail": true,
		"versions": true,
		"resolve_download": true,
		"update_check": true
	},
	"hosts": [
		"api.github.com",
		"github.com",
		"objects.githubusercontent.com",
		"release-assets.githubusercontent.com"
	],
	"manual_entry": [ /* ... */ ],
	"settings": [ /* ... */ ]
}
```

### `search: false` 但 `browse: true`

::: tip 这是刻意的
没有目录可搜，所以 `search: false`——搜索框对这个源不起作用。

但"浏览"是有意义的：**列出用户添加过的仓库**。所以 `browse: true`，实现在 `browse()` 里。

启动器不会因为 `search: false` 就隐藏这个源——它在浏览页照常出现。
:::

### 四个 hosts

```json
"hosts": [
	"api.github.com",
	"github.com",
	"objects.githubusercontent.com",
	"release-assets.githubusercontent.com"
]
```

- `api.github.com` —— REST API。
- `github.com` —— 详情页链接（其实不需要，但用户可能点到）。
- `objects.githubusercontent.com` / `release-assets.githubusercontent.com` —— **Release 资产的下载重定向目标**。

::: warning 后两个是最容易漏的
`https://github.com/owner/repo/releases/download/v1.0.0/file.jar` 会 **302 重定向**到 `objects.githubusercontent.com` 或 `release-assets.githubusercontent.com`。

只写 `github.com` 的话，API 调用没问题，但**点安装会失败**。这是「下载能拿到 URL 但装不上」这类问题的经典原因。
:::

### `manual_entry` 让用户选类型

```json
"manual_entry": [
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
	},
	{
		"key": "repo",
		"label": "仓库（owner/name）",
		"pattern": "^[^/\\s]+/[^/\\s]+$",
		"required": true
	},
	{
		"key": "rule",
		"label": "资产匹配规则（正则，可选）",
		"placeholder": "\\.jar$ 或 fabric.*1\\.21"
	},
	{
		"key": "prefer",
		"label": "优先包含（可选，逗号分隔）",
		"placeholder": "fabric,1.21"
	},
	{
		"key": "exclude",
		"label": "排除包含（可选，逗号分隔）",
		"placeholder": "sources,javadoc,dev"
	}
]
```

::: tip `type` 字段是必需的
因为这个源服务**四种内容类型**。没有一个带 `options` 的类型字段，用户加的条目会出现在**所有**四个标签页下。

官方在 `browse()` 里按 `entry.type === request.contentType` 过滤，就是为了这个。
:::

### 设置项

```json
"settings": [
	{
		"key": "token",
		"label": "GitHub 令牌（可选）",
		"description": "填了可把请求额度从每小时 60 次提高到 5000 次；读取私有仓库也必须填。",
		"type": "text",
		"default": ""
	},
	{
		"key": "assetMode",
		"label": "默认资产选择方式",
		"type": "select",
		"default": "jar",
		"options": [
			{ "value": "jar", "label": "任意 .jar（排除 sources/javadoc/dev）" },
			{ "value": "first", "label": "第一个资产" },
			{ "value": "largest", "label": "体积最大的资产" }
		]
	}
]
```

`token` 解决了 GitHub 未认证请求**每小时 60 次**的限制。

## 关键代码

### 读手动条目要防御性

```ts
async function entries(): Promise<MatchEntry[]> {
	const raw = await api.storage.get(MANUAL_ENTRIES_KEY)
	if (!raw) return []
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		api.log('条目数据不是合法 JSON，忽略')
		return []
	}
	if (!Array.isArray(parsed)) return []
	const seen = new Set<string>()
	const result: MatchEntry[] = []
	for (const item of parsed) {
		if (!item || typeof item !== 'object') continue
		const record = item as Record<string, unknown>
		const repo = typeof record.repo === 'string' ? record.repo.trim() : ''
		if (!repo || seen.has(repo.toLowerCase())) continue
		seen.add(repo.toLowerCase())
		// ...
	}
	return result
}
```

这段防御性很强，值得学。它在防：

1. **`JSON.parse` 抛错** —— 存储里是坏数据。
2. **不是数组** —— 用户手动改过，或者旧版本的结构。
3. **元素不是对象** —— 同上。
4. **`repo` 不是字符串 / 是空的** —— 跳过。
5. **重复的仓库**（大小写不敏感）—— 去重。

::: tip 存储里的东西是不可信的
`manualEntries` 是**用户能间接影响的**数据——他们通过表单填，也可能直接改存储文件。旧版本的插件写的结构可能和新版本不一样。

**永远不要假设 `JSON.parse` 的结果是你要的形状。**
:::

### README 的相对链接要转成绝对

```ts
async function readme(repo: string): Promise<string | undefined> {
	let body: string
	try {
		body = (await request(`/repos/${repo}/readme`, 'application/vnd.github.raw')).body
	} catch (error) {
		api.log(`读取 ${repo} 的 README 失败：${String(error)}`)
		return undefined
	}
	return absolutize(body, repo)
}
```

```ts
function absolutize(markdown: string, repo: string): string {
	const raw = (path: string) =>
		`https://raw.githubusercontent.com/${repo}/HEAD/${path
			.replace(/^\.?\//, '')
			.replace(/^\//, '')}`

	const isRelative = (url: string) => !/^([a-z][a-z0-9+.-]*:|#)/i.test(url)

	return markdown
		.replace(
			/(!?\[[^\]]*\]\()\s*([^)\s]+)([^)]*\))/g,
			(match, open: string, url: string, rest: string) =>
				isRelative(url) ? `${open}${raw(url)}${rest}` : match,
		)
		.replace(
			/(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
			(match, open: string, url: string, close: string) =>
				isRelative(url) ? `${open}${raw(url)}${close}` : match,
		)
}
```

**为什么需要这个？** README 里写 `![截图](./docs/screenshot.png)`。在 github.com 上浏览器会解析成仓库里的文件，但在这里——渲染的是一段**脱离仓库的 Markdown**——那个相对路径没有东西可以解析，图片会全部裂开。

所以把相对路径改成 `raw.githubusercontent.com` 的绝对地址。

::: tip `isRelative` 的判断很讲究
```ts
const isRelative = (url: string) => !/^([a-z][a-z0-9+.-]*:|#)/i.test(url)
```

**只有相对路径才改写。** 已经绝对的 URL（`https://...`）、`#锚点`、`mailto:` 这些都保持原样——那是作者的本意。

改了它们反而是破坏。
:::

### 多文件版本：让用户选

```ts
function toVersion(release: GitHubRelease): ContentVersion {
	return {
		id: release.tag_name,
		name: release.name ?? release.tag_name,
		versionNumber: release.tag_name,
		publishedAt: release.published_at ?? undefined,
		channel: release.prerelease ? 'beta' : 'release',
		body: release.body ?? undefined,
		url: release.html_url ?? undefined,
		// Every asset the reader might want, so a release with one jar per
		// loader can be chosen between rather than guessed at.
		files: downloadableAssets(release.assets ?? []).map((asset) => ({
			id: asset.name,
			name: asset.name,
			size: asset.size,
		})),
	}
}
```

一个 Release 经常有十几个文件：jar、sources jar、javadoc jar、校验和、各加载器的构建……**猜不出来用户要哪个**。

所以列出来让用户选。`downloadableAssets` 先过滤掉校验和/签名（`.sha1`、`.asc`、`.sig` 等）：

```ts
const NOT_A_DOWNLOAD = /\.(sha1|sha256|sha512|md5|asc|sig|txt|json)$/i

export function downloadableAssets(assets: ReleaseAsset[]): ReleaseAsset[] {
	return assets.filter((asset) => !NOT_A_DOWNLOAD.test(asset.name))
}
```

### 资产匹配：三级优先级

`matching.ts` 是独立的一个模块，专门做「从一堆资产里挑一个」。它的优先级是：

```ts
/**
 * 1. an explicit `rule` (a regular expression the author writes) wins, and if it
 *    matches nothing the release is treated as having no usable asset rather
 *    than silently falling back to a guess;
 * 2. otherwise a preset decides: any `.jar`, the first asset, or the largest;
 * 3. `exclude` removes names first, and `prefer` orders what is left by how many
 *    of its tokens the name contains.
 */
export function pickAsset(assets, entry, mode): ReleaseAsset | undefined
```

::: tip 「匹配不到」和「规则写错」要区分对待
```ts
/**
 * Throws only for a malformed rule: a bad regex is an authoring mistake worth
 * surfacing, while "no asset matched" is an ordinary outcome the UI explains.
 */
```

- **正则本身写错了**（比如 `[` 不闭合）→ **抛错**。这是作者的错误，要让人看见。
- **正则没匹配到任何东西** → 返回 `undefined`，由 UI 解释「这个版本没有符合规则的文件」。

**不要把这两种情况混在一起处理。** 一个需要修，一个只是正常结果。
:::

`prefer` 的排序逻辑：

```ts
const excluded = splitTokens(entry?.exclude)
// ...
// prefer 的 token 命中越多，排名越靠前
```

所以 `prefer: "fabric,1.21"` 会在多个加载器的构建里挑出 Fabric 的 1.21 版本。

### 下载时「用户选的」优先于「规则挑的」

```ts
async resolveDownload(id, versionId?, fileId?): Promise<DownloadDescriptor> {
	const release = versionId
		? await rest<GitHubRelease>(`/repos/${id}/releases/tags/${encodeURIComponent(versionId)}`)
		: await rest<GitHubRelease>(`/repos/${id}/releases/latest`)

	const assets = release.assets ?? []
	// A file the reader picked outranks the entry's rule: they chose it.
	const asset = fileId
		? assets.find((candidate) => candidate.name === fileId)
		: pickAsset(assets, await entryFor(id), await assetMode())

	if (!asset) {
		throw new Error(
			fileId
				? `${release.tag_name} 里没有名为「${fileId}」的文件。`
				: `${release.tag_name} 里没有符合条件的资产。请在内容源设置里调整该条目的匹配规则，或换一个版本。`,
		)
	}
	// ...
}
```

::: tip 用户的选择永远优先
`fileId` 是用户在版本页的文件列表里**手动挑的**。它比条目配置的规则优先级高——用户明确选了，就不要用规则去覆盖他。

这是「显式选择 > 隐式规则」的一般原则。
:::

### 错误信息带上 GitHub 自己的话

```ts
async function request(path: string, accept = 'application/vnd.github+json') {
	const response = await api.net.fetch(`https://api.github.com${path}`, {
		headers: await apiHeaders(accept),
	})
	if (!response.ok) {
		let detail = ''
		try {
			const body = JSON.parse(response.body) as { message?: string }
			detail = body.message ? `：${body.message}` : ''
		} catch {
			// A non-JSON error body tells us nothing extra.
		}
		throw new Error(`GitHub ${response.status} ${path}${detail}`)
	}
	return response
}
```

GitHub 的错误响应体里有 `message`，比如 `"API rate limit exceeded for ..."`。把它带进错误信息里，用户就知道是**限流**而不是「仓库不存在」——这两种情况的解决办法完全不同（填 token vs 改仓库名）。

### 更新检查：读不到就当作「已是最新」

```ts
async function checkUpdate(items: UpdateQueryItem[]): Promise<UpdateResult[]> {
	const results: UpdateResult[] = []
	for (const item of items) {
		try {
			const release = await rest<GitHubRelease>(`/repos/${item.id}/releases/latest`)
			const tag = release.tag_name
			if (tag && tag !== item.currentVersionId) {
				results.push({ id: item.id, latestVersionId: tag, latestVersionName: release.name ?? tag })
			} else {
				results.push({ id: item.id })
			}
		} catch (error) {
			api.log(`检查 ${item.id} 更新失败：${String(error)}`)
			results.push({ id: item.id }) // 当作没有更新
		}
	}
	return results
}
```

::: tip 后台检查应该"安静"
注释里说：*a background check should stay quiet, and the install list is the place a broken entry gets noticed*。

读不到的条目**当作已是最新**（而不是报错）——因为更新检查是后台进行的，为一个个别失败的条目弹错误会打扰用户。真正需要发现"这个条目坏了"的地方是安装列表。

**注意每个条目都要返回一个结果**（哪怕只有 `{ id }`），否则启动器对不上。
:::

### `browse` 里单个条目失败不拖垮整页

```ts
async browse(request: ContentQuery): Promise<ContentPage> {
	// ...
	const items: ContentCard[] = []
	for (const entry of matching) {
		try {
			const repo = await rest<GitHubRepo>(`/repos/${entry.repo}`)
			items.push(toCard(repo, request.contentType, undefined, entry.name))
		} catch (error) {
			api.log(`跳过 ${entry.repo}：${String(error)}`)
		}
	}
	return { items, total: items.length }
}
```

用户手动加的仓库可能有拼写错误、可能被删了、可能是私有的。**一个坏的条目不应该让整个列表变空**。

## 小结：这篇教了什么

| 技巧 | 用在什么场合 |
|---|---|
| `search: false` + `browse: true` | 没有目录的源 |
| 手动条目 + 类型字段 | 用户自己添加内容 |
| 重定向域名要写进 hosts | 下载会 302 |
| 防御性解析存储数据 | 用户可影响的数据 |
| README 相对链接绝对化 | 渲染脱离仓库的 Markdown |
| 多文件版本让用户选 | 猜不出来的选择 |
| 区分「规则写错」和「没匹配到」 | 错误处理 |
| 用户选择优先于规则 | 显式 > 隐式 |
| 错误信息带上站点的原话 | 便于诊断 |
| 后台检查要安静 | 更新检查 |
| 单个条目失败不拖垮整页 | 用户提供的数据 |

---

接下来：[拆解：CurseForge 源](/cookbook/curseforge-source)。
