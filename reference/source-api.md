# 内容源参考：`api` 对象

`activate(api)` 拿到的 `api` 对象。这是**权威参考**——类型定义在商店仓库的 [`sdk/index.d.ts`](https://github.com/Wemsur/Celestial-Plugin-Store/blob/main/sdk/index.d.ts)。

```ts
export async function activate(api: ContentSourceApi) {
	// ...
}
```

## `api.source`

这个内容源自己的身份，来自 manifest。只读。

```ts
api.source.id // string —— manifest 里的 id
api.source.name // string
api.source.version // string
api.source.manifest // ContentSourceManifest —— 解析后的整个 manifest
```

| 属性 | 类型 |
|---|---|
| `id` | `string` |
| `name` | `string` |
| `version` | `string` |
| `manifest` | `ContentSourceManifest` |

## `api.i18n`

```ts
api.i18n.locale // string，如 'zh-CN'
```

启动器当前界面语言。**实时读取**——用户切换语言后下次读就是新值。

## `api.net`

唯一的网络出口。见[网络与 hosts 白名单](/source/network)。

```ts
api.net.fetch(url: string, options?: SourceFetchOptions): Promise<SourceFetchResult>
```

### `SourceFetchOptions`

| 字段 | 类型 | 说明 |
|---|---|---|
| `method` | `string` | `GET`（默认）、`POST`、`PUT`、`PATCH`、`DELETE`、`HEAD` |
| `headers` | `Record<string, string>` | 请求头。`host`、`content-length`、`connection`、`transfer-encoding`、`proxy-*` 会被忽略 |
| `body` | `string` | 请求体 |

### `SourceFetchResult`

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | `number` | HTTP 状态码 |
| `ok` | `boolean` | 状态码在 200-299 |
| `headers` | `Record<string, string>` | 响应头 |
| `body` | `string` | 响应体（字符串，不是 stream） |
| `final_url` | `string \| undefined` | 跟随重定向后的最终地址 |

限制：响应体 ≤ 16 MiB，请求体 ≤ 4 MiB。

## `api.storage`

按插件隔离的键值存储。值一律是字符串。

```ts
api.storage.get(key: string): Promise<string | null>
api.storage.set(key: string, value: string): Promise<void>
api.storage.remove(key: string): Promise<void>
api.storage.keys(): Promise<string[]>
```

## `api.settings`

用户按 manifest 的 `settings` 填的值。**只读**。

```ts
api.settings.get(key: string): Promise<string | null>
api.settings.all(): Promise<Record<string, string>>
```

## `api.register`

注册 provider。**只调用一次**。

```ts
api.register(provider: ContentSourceProvider): void
```

## `api.log`

```ts
api.log(...args: unknown[]): void
```

输出到启动器日志，自动加 `[content-source:<id>]` 前缀。

## `ContentSourceApi` 完整形状

```ts
interface ContentSourceApi {
	readonly i18n: { readonly locale: string }
	readonly source: {
		readonly id: string
		readonly name: string
		readonly version: string
		readonly manifest: ContentSourceManifest
	}
	readonly net: {
		fetch(url: string, options?: SourceFetchOptions): Promise<SourceFetchResult>
	}
	readonly storage: {
		get(key: string): Promise<string | null>
		set(key: string, value: string): Promise<void>
		remove(key: string): Promise<void>
		keys(): Promise<string[]>
	}
	readonly settings: {
		get(key: string): Promise<string | null>
		all(): Promise<Record<string, string>>
	}
	register(provider: ContentSourceProvider): void
	log(...args: unknown[]): void
}
```

## 导出的类型

从 `@celestial/content-source` 可以导入的类型：

**内容类型与排序**：`ContentType`、`ContentSort`

**manifest**：`ContentSourceManifest`、`SourceCapabilities`、`SourceDetailFormat`、`SourceAuth`、`SourceSettingField`、`SourceSettingType`、`SourceSettingOption`、`ManualEntryField`

**查询与结果**：`ContentQuery`、`ContentCard`、`ContentPage`、`ContentProject`、`ContentVersion`、`ContentFile`

**筛选**：`SourceFilterGroup`、`SourceFilterOption`（别名 `ContentFilterGroup`、`ContentFilterOption`）

**整合包**：`ContentModpackPlan`、`ContentModpackFile`

**下载与更新**：`DownloadDescriptor`、`UpdateQueryItem`、`UpdateResult`

**provider 与 api**：`ContentSourceProvider`、`ContentSourceApi`、`SourceFetchOptions`、`SourceFetchResult`、`ManualEntriesStorageKey`

**入口**：`activate`

```ts
import type {
	ContentCard,
	ContentPage,
	ContentQuery,
	ContentSourceApi,
	ContentType,
	DownloadDescriptor,
} from '@celestial/content-source'
```

---

下一篇：[provider 全量](/reference/source-provider)。
