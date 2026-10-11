# manifest.json 字段

启动器会**逐项校验**这个文件。不合规的内容源不会被加载，并在「设置 → 内容源」里显示原因。

这一页是逐字段的完整参考。第一次写建议对照[快速开始](/guide/getting-started-source)里的例子。

## 完整示例

```json
{
	"id": "example",
	"name": "示例内容站",
	"version": "0.1.0",
	"description": "示例站的模组与资源包。",
	"author": "你的名字",
	"homepage": "https://example.com",
	"icon": "icon.svg",
	"color": "#4a90d9",
	"detail_format": "markdown",
	"api_version": 1,
	"entry": "dist/index.js",
	"content_types": ["mod", "resourcepack"],
	"capabilities": {
		"search": true,
		"browse": true,
		"detail": true,
		"versions": true,
		"resolve_download": true,
		"update_check": false
	},
	"hosts": ["example.com", "*.example.com"],
	"settings": [],
	"manual_entry": []
}
```

## 标识

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | 唯一标识，**同时用作文件夹名**。只允许字母、数字、`.`、`-`、`_`；最长 128 字符；不能以 `.` 开头或结尾；不能含 `..` |
| `name` | ✅ | 显示名称，不能为空 |
| `version` | ✅ | 语义化版本，如 `0.1.0`。**发布时必须和 git tag 一致** |
| `description` | | 一句话说明 |
| `author` | | 作者 |
| `homepage` | | 主页 |

::: danger `id` 就是文件夹名
启动器把内容源装到 `content-sources/<id>/`。所以 `id` 里的字符要能在所有平台上当目录名。

写成 `../../evil` 会被直接拒绝——这条校验是有意的，不是啰嗦。
:::

`id` 用不用反向域名？**不强制。** 内容源不像 UI 插件那样建议用 `com.example.foo`，官方的四个源就分别叫 `github`、`pixelmap`、`curseforge`、`mcmod`。短名字更好看，只要全局唯一即可。

## 外观

| 字段 | 说明 |
|---|---|
| `icon` | **你自己目录内的**图片相对路径，如 `icon.png`、`icon.svg`。svg / png / webp 都行；不允许 `..` 或绝对路径 |
| `color` | 主题色 `#rrggbb`。用于卡片左侧渐变、详情页背景、以及没有图标时的降级标记 |

没有 `icon` 时，启动器用 `name` 的首字母画在 `color` 色的**圆角方块**上。`color` 也用于给这个源的卡片染色（[源徽章](/reference/content-types#源徽章)）。

::: tip 图标建议用圆角方形
启动器的插件图标语言是圆角方形，不是圆形。你提供 svg 时自己画成方形的即可，启动器会按 6px 圆角裁切。png 的话建议至少 256×256。
:::

## 能力声明

```json
"capabilities": {
	"search": true,
	"browse": true,
	"detail": true,
	"versions": true,
	"resolve_download": true,
	"update_check": false
}
```

| 能力 | 对应实现 | 声明为 `false` 的后果 |
|---|---|---|
| `search` | `search(request)` | 搜索框对你这个源不起作用 |
| `browse` | `browse(request)` | 不带关键词浏览时不列出你的内容 |
| `detail` | `detail(id)` | 点进去没有详情页内容 |
| `versions` | `versions(id, request)` | 版本标签页不显示 |
| `resolve_download` | `resolveDownload(id, versionId?, fileId?)` | **安装按钮不可用** |
| `update_check` | `checkUpdate(items)` | 不参与更新检查 |

全部字段都是布尔，缺省为 `false`。

::: danger 字段名是 snake_case
`resolve_download`、`update_check`，**不是** `resolveDownload`、`updateCheck`。

写成 camelCase 不会报错——JSON 里多一个没人读的字段而已——但那个能力会被当成 `false`。这是最难发现的一类错误，因为启动器不会抱怨。

（顺带一提：**方法名**才是 camelCase，`provider.resolveDownload(...)`。别搞反。）
:::

**别声明你实现不了的能力。** 声明 `resolve_download: true` 却返回不了地址，用户看到的是点了安装后弹错误，而不是按钮从一开始就灰掉。

## 内容类型

```json
"content_types": ["mod", "resourcepack"]
```

取值必须是启动器的封闭集合：

| 取值 | 含义 |
|---|---|
| `mod` | 模组 |
| `modpack` | 整合包 |
| `resourcepack` | 资源包 |
| `shader` | 光影 |
| `datapack` | 数据包 |
| `world` | 世界（地图） |
| `skin` | 皮肤 |

::: danger 注意拼写
`resourcepack`、`datapack` 是**连写**的，不是 `resource_pack`、`data_pack`。

写成后者会得到一个 serde 错误：

```
manifest.json is not valid: unknown variant `resource_pack`, expected one of `mod`, `modpack`, `resourcepack`, ...
```

（启动器特意把错误信息包了一层，就是为了让这种错误能定位到文件。）
:::

不在这个列表里的类型会让**整个 manifest** 被拒绝。

## 网络白名单

```json
"hosts": ["example.com", "*.example.com", "cdn.example.com:8443"]
```

`api.net.fetch` **只能**访问这里声明过的域名，其他一律被后端拒绝。

| 写法 | 匹配 |
|---|---|
| `example.com` | 只有 `example.com` |
| `*.example.com` | 一级子域，如 `api.example.com`；**不**匹配 `a.b.example.com` |
| `example.com:8443` | 带端口 |

::: warning 精确匹配，别漏
访问 `api.example.com` 只写 `example.com` **不够**。要把实际请求的每个域名都列上。

官方 GitHub 源的 `hosts` 就列了四个：`api.github.com`、`github.com`、`objects.githubusercontent.com`、`release-assets.githubusercontent.com`——因为一个 Release 的下载会重定向到后两个。
:::

## 呈现方式

```json
"detail_format": "markdown"
```

| 取值 | 说明 |
|---|---|
| `markdown`（默认） | `detail` 返回的 `body` 按 Markdown 渲染，经过 XSS 消毒 |
| `text` | 按纯文本原样显示，不解释任何格式字符 |

启动器**自己渲染**你的正文，所以：

- 你返回的 HTML **不会**原样进入页面（会被消毒或转义）。
- 你不用也不该自己生成 HTML。

Markdown 渲染支持常见的 Markdown 语法，但**图片的域名也受 `hosts` 影响**——详情页里的图片要么来自你 `hosts` 里的域名，要么走启动器的图片代理。见[详情页](/source/detail#图片)。

## 设置项

声明后启动器**自动生成表单**，用户填的值存进源的存储，你用 `api.settings.get(key)` 读回。

```json
"settings": [
	{
		"key": "apiKey",
		"label": "API Key",
		"description": "留空则使用内置值。",
		"type": "text",
		"default": ""
	},
	{
		"key": "region",
		"label": "线路",
		"type": "select",
		"default": "auto",
		"options": [
			{ "value": "auto", "label": "自动" },
			{ "value": "mirror", "label": "镜像" }
		]
	}
]
```

| 字段 | 说明 |
|---|---|
| `key` | 存储键名，不能为空 |
| `label` | 表单上显示的名称 |
| `description` | 可选的说明文字 |
| `type` | `text`、`number`、`toggle`、`select` |
| `default` | 默认值（**字符串**） |
| `options` | `select` 专用；`select` 没有 `options` 会被拒绝 |

值一律以**字符串**存取。`toggle` 的值是 `"true"` / `"false"`。

详见[设置与存储](/source/settings-storage)。

## 手动条目

像 GitHub 这种「没有可浏览的内容目录」的源，可以让用户手工添加条目：

```json
"manual_entry": [
	{
		"key": "repo",
		"label": "仓库（owner/name）",
		"placeholder": "FabricMC/fabric-api",
		"pattern": "^[^/\\s]+/[^/\\s]+$",
		"required": true
	},
	{
		"key": "type",
		"label": "内容类型",
		"required": true,
		"options": [
			{ "value": "mod", "label": "模组" },
			{ "value": "resourcepack", "label": "资源包" }
		]
	}
]
```

| 字段 | 说明 |
|---|---|
| `key` | 存储时用的键 |
| `label` | 表单上显示的名称 |
| `description` / `placeholder` | 可选的提示 |
| `pattern` | 一个正则，不匹配时表单给出提示（**真正的把关在你自己的校验里**） |
| `options` | 有它时渲染成下拉框，没有则渲染成输入框 |
| `required` | 是否必填 |

用户填的条目以 JSON 数组形式存在源的存储里，键名固定是 `manualEntries`：

```ts
const raw = await api.storage.get('manualEntries') // JSON 字符串或 null
const entries = raw ? JSON.parse(raw) : []
```

详见[手动条目](/source/manual-entry)。

## 登录

```json
"auth": { "required": true, "login_url": "https://example.com/login" }
```

| 字段 | 说明 |
|---|---|
| `required` | 是否必须登录才能工作 |
| `login_url` | 启动器打开的登录页 |
| `help_url` | 可选的帮助链接 |

声明后启动器会在界面里提示需要登录并提供链接。

::: warning 登录态要自己保存
启动器只负责**打开登录页**。登录之后拿到的东西（cookie、token）怎么存、怎么在请求里带上，是**你的责任**——用 `api.storage` 存，用 `api.net.fetch` 的 `headers` 带。

`api.net.fetch` 允许 `cookie`、`referer`、`user-agent`、`authorization` 这些头，正是为了这个场景。
:::

## 其他

| 字段 | 必填 | 说明 |
|---|---|---|
| `api_version` | | 契约版本，当前只能是 `1`。高于启动器支持上限的会被拒绝 |
| `entry` | ✅ | 入口 bundle，相对路径，通常是 `dist/index.js`。不能有 `..` 或绝对路径 |

## 校验失败会怎样

manifest 有问题时，**整个源不加载**，错误显示在「设置 → 内容源」的卡片上。错误信息会尽量指出具体字段：

```
manifest.json is not valid: unknown variant `shaders`, expected one of `mod`, `modpack`, ...
Invalid content source id '../evil': use letters, digits, '.', '-' or '_' (max 128 characters, no leading or trailing '.')
Content source 'x' needs content-source API version 2, but this launcher supports up to 1
Content source 'x' declares an invalid icon '../icon.png': icon must be a relative path inside the source folder
```

manifest 文件本身有 **256 KiB** 上限——超过会被当成异常输入拒绝。

---

接下来：[网络与 hosts 白名单](/source/network)。
