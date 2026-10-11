# UI 插件参考：manifest 全字段

`PluginManifest` 的完整字段表。讲解见 [manifest 与权限](/plugin/manifest-permissions)。

## 完整形状

```ts
interface PluginManifest {
	id: string
	name: string
	description?: string
	version: string
	author?: string
	homepage?: string
	icon?: string
	type?: 'ui' | 'sidecar' // 默认 'ui'
	api_version?: number // 默认 1
	entry?: string // UI 插件必填
	permissions?: string[]
	settings?: PluginSettingField[]
	sidecar?: unknown // type: 'sidecar' 时必填
}
```

## 字段表

| 字段 | 类型 | 必填 | 默认 | 约束 |
|---|---|---|---|---|
| `id` | `string` | ✅ | | 字母数字 `.` `-` `_`；≤128；不以 `.` 开头/结尾；不含 `..` |
| `name` | `string` | ✅ | | 非空 |
| `version` | `string` | ✅ | | 非空；发布时与 tag 一致 |
| `type` | `'ui' \| 'sidecar'` | | `ui` | |
| `api_version` | `number` | | `1` | 必须是 `1` |
| `entry` | `string` | UI 插件 ✅ | | 相对路径，无 `..` |
| `permissions` | `string[]` | | `[]` | 每项 `kind` 或 `kind:scope` |
| `settings` | `PluginSettingField[]` | | `[]` | `select` 必须有 `options` |
| `icon` | `string` | | | 相对路径 |
| `sidecar` | — | `type: 'sidecar'` 时 ✅ | | |

## `permissions`

字符串数组，每项 `kind` 或 `kind:scope`：

```json
"permissions": ["style", "storage", "slot:sidebar.top", "network:example.com"]
```

完整清单见[权限总表](/reference/permissions)。

## `PluginSettingField` / `PluginSettingOption`

```ts
PluginSettingField {
	key: string // 非空；和 api.storage 同一命名空间
	label: string
	description?: string
	type: 'toggle' | 'text' | 'number' | 'select'
	default?: string // 字符串
	options?: PluginSettingOption[] // select 必须有
}

PluginSettingOption {
	value: string
	label?: string
}
```

::: tip `key` 和 `api.storage` 共用命名空间
`api.settings.get(key)` 和 `api.storage.get(key)` 读的是同一个存储。所以设置字段的 `key` 别和你的内部存储键撞名。
:::

## 校验失败的错误信息

```
Plugin 'x' is a UI plugin but declares no entry
Plugin 'x' declares an invalid permission 'slot': 'slot' needs a scope, e.g. 'slot:example'
Plugin 'x' declares an invalid permission 'style:global': 'style' does not take a scope
Plugin 'x' has an invalid icon '../icon.png': icon must be a relative path inside the plugin folder
Plugin 'x' needs plugin API version 2, but this launcher supports up to 1
Plugin 'x' setting 'region' is a select but has no options
Plugin 'x' has a setting with an empty key
```

manifest 文件上限 **256 KiB**。

---

下一篇：[权限总表](/reference/permissions)。
