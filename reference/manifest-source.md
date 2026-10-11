# 内容源参考：manifest 全字段

`ContentSourceManifest` 的完整字段表。讲解见 [manifest.json 字段](/source/manifest)。

## 完整形状

```ts
interface ContentSourceManifest {
	id: string
	name: string
	version: string
	description?: string
	author?: string
	homepage?: string
	icon?: string
	color?: string
	detail_format?: SourceDetailFormat
	api_version: number
	entry: string
	content_types: ContentType[]
	capabilities: SourceCapabilities
	hosts: string[]
	auth?: { required: boolean; login_url?: string; help_url?: string }
	manual_entry?: ManualEntryField[]
	settings?: SourceSettingField[]
}
```

## 字段表

| 字段 | 类型 | 必填 | 默认 | 约束 |
|---|---|---|---|---|
| `id` | `string` | ✅ | | 字母数字 `.` `-` `_`；≤128；不以 `.` 开头/结尾；不含 `..` |
| `name` | `string` | ✅ | | 非空 |
| `version` | `string` | ✅ | | 非空；发布时与 tag 一致 |
| `description` | `string` | | | |
| `author` | `string` | | | |
| `homepage` | `string` | | | |
| `icon` | `string` | | | 相对路径，无 `..`、无绝对路径 |
| `color` | `string` | | | `#rrggbb` |
| `detail_format` | `SourceDetailFormat` | | `markdown` | `markdown` \| `text` |
| `api_version` | `number` | | `1` | 必须是 `1` |
| `entry` | `string` | ✅ | | 相对路径，无 `..` |
| `content_types` | `ContentType[]` | ✅ | | 非空，取值见下 |
| `capabilities` | `SourceCapabilities` | | 全 `false` | |
| `hosts` | `string[]` | | `[]` | 域名或 `*.域名` |
| `auth` | `SourceAuth` | | | |
| `manual_entry` | `ManualEntryField[]` | | `[]` | |
| `settings` | `SourceSettingField[]` | | `[]` | `select` 必须有 `options` |

## `ContentType`

```ts
type ContentType =
	| 'mod'
	| 'modpack'
	| 'resourcepack'
	| 'shader'
	| 'datapack'
	| 'world'
	| 'skin'
```

## `SourceCapabilities`

```ts
interface SourceCapabilities {
	search: boolean
	browse: boolean
	detail: boolean
	versions: boolean
	resolve_download: boolean // ← snake_case
	update_check: boolean // ← snake_case
}
```

::: danger `resolve_download` / `update_check` 是 snake_case
manifest 里的字段名**全是 snake_case**，但对应的 **provider 方法名是 camelCase**（`resolveDownload`、`checkUpdate`）。别搞反。
:::

## `SourceDetailFormat`

```ts
type SourceDetailFormat = 'markdown' | 'text'
```

## `SourceAuth`

```ts
{
	required: boolean
	login_url?: string
	help_url?: string
}
```

## `SourceSettingField` / `SourceSettingOption`

```ts
SourceSettingField {
	key: string // 非空
	label: string
	description?: string
	type: 'toggle' | 'text' | 'number' | 'select'
	default?: string // 字符串
	options?: SourceSettingOption[] // select 必须有
}

SourceSettingOption {
	value: string
	label?: string
}
```

## `ManualEntryField`

```ts
ManualEntryField {
	key: string
	label: string
	description?: string
	placeholder?: string
	pattern?: string // 正则字符串
	options?: SourceSettingOption[] // 有它则渲染成下拉框
	required?: boolean
}
```

用户填的条目存在 `api.storage` 的 `'manualEntries'` 键下，是 JSON 数组。

## `ContentSort`

```ts
type ContentSort = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'
```

---

下一篇：[内容类型表](/reference/content-types)。
