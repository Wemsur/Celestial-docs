# 内容源参考：provider

你在 `api.register(provider)` 里传的对象。**只实现 `capabilities` 声明为 `true` 的方法。**

```ts
api.register({
	search, browse, detail, versions, resolveDownload, checkUpdate,
	filters, resolveModpack,
})
```

| 方法 | 需要声明 | 说明 |
|---|---|---|
| `search` | `capabilities.search` | [搜索](/source/search-browse) |
| `browse` | `capabilities.browse` | [浏览](/source/search-browse) |
| `detail` | `capabilities.detail` | [详情页](/source/detail) |
| `versions` | `capabilities.versions` | [版本列表](/source/versions) |
| `resolveDownload` | `capabilities.resolve_download` | [下载地址](/source/resolve-download) |
| `checkUpdate` | `capabilities.update_check` | [更新检查](/source/update-check) |
| `filters` | 无需声明 | [侧边栏筛选](/source/filters) |
| `resolveModpack` | 无需声明 | [整合包](/source/modpacks) |

所有方法都可以是 `async`。

## `search(request)`

```ts
search?(request: ContentQuery): Promise<ContentPage>
```

| 参数 | 类型 |
|---|---|
| `request` | `ContentQuery` |

返回 `ContentPage`：`{ items: ContentCard[], total: number }`。

## `browse(request)`

```ts
browse?(request: ContentQuery): Promise<ContentPage>
```

签名同 `search`，区别是 `request.query` 为空。

## `detail(id, contentType)`

```ts
detail?(id: string, contentType: ContentType): Promise<ContentProject>
```

| 参数 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 你给的项目 id |
| `contentType` | `ContentType` | 用户从哪个标签页点进来的 |

返回 `ContentProject`（`ContentCard` + `body` / `gallery` / `license` / `links` / `versions`）。

## `versions(id, request)`

```ts
versions?(id: string, request: ContentQuery): Promise<ContentVersion[]>
```

返回版本数组。

## `resolveDownload(id, versionId?, fileId?)`

```ts
resolveDownload?(
	id: string,
	versionId?: string,
	fileId?: string,
): Promise<DownloadDescriptor>
```

| 参数 | 说明 |
|---|---|
| `id` | 项目 id |
| `versionId` | 用户选的版本（没选则 `undefined`） |
| `fileId` | 用户在 `versions()` 的 `files` 里挑的文件 id |

返回 `DownloadDescriptor`：`{ url, headers?, fileName?, hash? }`。

## `checkUpdate(items)`

```ts
checkUpdate?(items: UpdateQueryItem[]): Promise<UpdateResult[]>
```

传入要检查的条目数组，返回结果数组（没更新的条目也要返回 `{ id }`）。

## `filters(contentType)`

```ts
filters?(contentType: ContentType): Promise<SourceFilterGroup[]>
```

返回侧边栏筛选组。**不需要在 `capabilities` 里声明。**

## `resolveModpack(manifestJson)`

```ts
resolveModpack?(manifestJson: string): Promise<ContentModpackPlan>
```

启动器下载整合包 zip、解压出 `manifest.json` 后，把**原文**交给你，你返回安装计划。**不需要在 `capabilities` 里声明**（`content_types` 里有 `modpack` 时才会被调用）。

## 数据结构

### `ContentQuery`

| 字段 | 类型 | 说明 |
|---|---|---|
| `query` | `string \| undefined` | 搜索词，browse 时为空 |
| `contentType` | `ContentType` | 当前标签页 |
| `gameVersion` | `string \| undefined` | 用户选的游戏版本 |
| `loader` | `string \| undefined` | 用户选的加载器 |
| `sort` | `ContentSort` | `relevance` / `downloads` / `follows` / `newest` / `updated` |
| `page` | `number` | 从 1 开始 |
| `limit` | `number` | 每页条数 |
| `category` | `string \| undefined` | 源自己的分类 id |
| `filters` | `Record<string, unknown> \| undefined` | 组 id → 勾选的选项 id 数组 |

### `ContentCard`

| 字段 | 类型 | 必填 |
|---|---|---|
| `sourceId` | `string` | ✅ 填 `api.source.id` |
| `id` | `string` | ✅ 你的项目 id |
| `contentType` | `ContentType` | ✅ |
| `name` | `string` | ✅ |
| `summary` | `string` | |
| `iconUrl` | `string` | |
| `author` | `string` | |
| `downloads` | `number` | 原始值，启动器会乘倍率 |
| `follows` | `number` | |
| `publishedAt` | `string` | ISO 8601 |
| `updatedAt` | `string` | ISO 8601 |
| `gameVersions` | `string[]` | |
| `loaders` | `string[]` | |
| `tags` | `string[]` | |

### `ContentProject`

`ContentCard` 加上：

| 字段 | 类型 |
|---|---|
| `body` | `string` —— 按 `detail_format` 渲染 |
| `gallery` | `{ url: string; title?: string }[]` |
| `license` | `string` |
| `links` | `{ label: string; url: string }[]` |
| `versions` | `ContentVersion[]` |

### `ContentVersion`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | ✅ 会传回 `resolveDownload` |
| `name` | `string` | |
| `versionNumber` | `string` | 表格「版本」列显示的就是它 |
| `gameVersions` | `string[]` | |
| `loaders` | `string[]` | 用启动器的拼写 |
| `publishedAt` | `string` | ISO 8601 |
| `downloads` | `number` | |
| `channel` | `string` | `release` / `beta` / `alpha` |
| `body` | `string` | 更新日志 |
| `url` | `string` | 该版本在你站点的页面 |
| `files` | `ContentFile[]` | 多文件时列出 |

### `ContentFile`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | ✅ 会作为 `fileId` 传回 |
| `name` | `string` | |
| `size` | `number` | 字节 |

### `DownloadDescriptor`

| 字段 | 类型 | 必填 |
|---|---|---|
| `url` | `string` | ✅ 文件直链 |
| `headers` | `Record<string, string>` | |
| `fileName` | `string` | 不填用 URL 最后一段 |
| `hash` | `{ algorithm: 'sha1' \| 'sha512'; value: string }` | |

### `SourceFilterGroup` / `SourceFilterOption`

```ts
SourceFilterGroup {
	id: string
	header: string // 'categories' / 'features' / 'performance impact' 时合并
	options: SourceFilterOption[]
}

SourceFilterOption {
	id: string // 稳定，会回传
	label?: string // 可翻译
}
```

### `ContentModpackPlan` / `ContentModpackFile`

```ts
ContentModpackPlan {
	gameVersion: string
	loader: 'vanilla' | 'forge' | 'neoforge' | 'fabric' | 'quilt'
	loaderVersion?: string
	files: ContentModpackFile[]
}

ContentModpackFile {
	url: string
	fileName: string
	hashSha1?: string
	folder?: string // 默认 'mods'
}
```

### `UpdateQueryItem` / `UpdateResult`

```ts
UpdateQueryItem {
	id: string
	contentType: ContentType
	currentVersionId?: string
	gameVersion?: string
	loader?: string
	installRule?: Record<string, unknown>
}

UpdateResult {
	id: string
	latestVersionId?: string
	latestVersionName?: string
}
```

---

下一篇：[manifest 全字段](/reference/manifest-source)。
