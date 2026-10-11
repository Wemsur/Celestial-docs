# manifest 与权限

UI 插件的 manifest 决定它**能做什么**。这一页讲字段、权限模型，以及最重要的一件事：**怎么优雅降级**。

## 完整示例

```json
{
	"id": "com.example.my-plugin",
	"name": "My Plugin",
	"description": "一个示例插件。",
	"version": "1.0.0",
	"author": "你的名字",
	"homepage": "https://example.com",
	"icon": "icon.png",
	"type": "ui",
	"api_version": 1,
	"entry": "dist/index.js",
	"permissions": ["style", "storage", "slot:sidebar.top", "route"],
	"settings": []
}
```

## 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✅ | 唯一标识，**同时用作文件夹名**。只允许字母、数字、`.`、`-`、`_`；最长 128 字符；不能以 `.` 开头或结尾；不能含 `..` |
| `name` | ✅ | 显示名称，不能为空 |
| `version` | ✅ | 语义化版本。**发布时必须和 git tag 一致** |
| `type` | | `"ui"`（默认）或 `"sidecar"`。UI 插件填 `"ui"` 或省略 |
| `api_version` | | 契约版本，当前只能是 `1` |
| `entry` | ✅ | UI 插件的入口 bundle，相对路径。**不能有 `..` 或绝对路径** |
| `permissions` | | 权限数组 |
| `settings` | | 声明式设置项，启动器生成表单 |
| `icon` | | 你自己目录内的图片路径 |
| `description` / `author` / `homepage` | | 元信息 |
| `sidecar` | | `type: "sidecar"` 时必填 |

::: tip `id` 建议用反向域名
内容源的 `id` 随便起（官方的叫 `github`、`curseforge`），但 **UI 插件建议用反向域名**——`com.example.my-plugin`、`cn.terracotta.celestial`。

因为 UI 插件可能注册路由、插槽、事件这些**全局命名空间**，冲突的概率比内容源高。反向域名能保证不撞车。
:::

## 权限

`permissions` 是一个字符串数组，每项是 `kind` 或 `kind:scope`：

```json
"permissions": ["style", "storage", "slot:sidebar.top", "network:example.com"]
```

### 全部权限

| 权限 | scope | 风险 | 能力 |
|---|---|---|---|
| `storage` | 无 | 低 | 读写自己的数据目录 |
| `style` | 无 | 低 | 注入 CSS |
| `slot:<位置>` | 插槽 id | 低 | 往插槽放 UI |
| `route` | 无 | 低 | 注册自定义页面 |
| `event:<类型>` | 事件类型 | 低 | 订阅应用事件 |
| `network:<域名>` | 域名 | **高** | 访问指定域名 |
| `region:<区域>` | 区域 id | **高** | 接管结构区域 |
| `hostapi:<名称>` | 接口名 | **高** | 调用宿主接口 |
| `sidecar` | 无 | **高** | 下载并运行原生程序 |
| `lan` | 无 | **高** | 局域网联机广播 |

完整的 scope 取值见[权限总表](/reference/permissions)。

::: danger scope 的有无是强校验
**该带 scope 的必须带，不该带的不能带。** 两边的错误都会让整个 manifest 被拒绝：

```json
"permissions": ["slot"]            // ❌ slot 需要 scope
"permissions": ["slot:sidebar.top"] // ✅
"permissions": ["style:global"]    // ❌ style 不接受 scope
"permissions": ["style"]           // ✅
"permissions": ["sidecar:foo"]     // ❌ sidecar 不接受 scope
"permissions": ["sidecar"]         // ✅
```

不带 scope 的 kind：`storage`、`style`、`route`、`sidecar`、`lan`。
带 scope 的 kind：`slot`、`event`、`network`、`region`、`hostapi`。
:::

### 低风险：自动授予

装上即生效，用户不需要点任何东西。最坏情况是「启动器变丑了」，所以不设门槛。

### 高风险：需要用户批准

「设置 → 插件」页里，每个高风险权限显示为一个**可点击的标签**，未批准时带「click to approve」提示。用户点一下才生效。

## 优雅降级

::: danger 这是 UI 插件最容易写错的地方
**未批准的权限被调用时抛错，而不是静默失效。**

```ts
// 用户没批准 hostapi:instance.list 时
await api.hostApi.call('instance.list')
// → Error: Plugin "com.example.x" cannot use hostApi: the "hostapi:instance.list" permission has not been granted.
```

如果这个调用在 `activate()` 顶层没有包 `try`，**整个插件会启动失败**——卡片、页面、样式全都不工作。
:::

所以你要假设「权限随时可能没有」：

```ts
// ✅ 优雅降级
let instanceCount: number | null = null
try {
	const instances = await api.hostApi.call('instance.list')
	instanceCount = Array.isArray(instances) ? instances.length : 0
} catch {
	instanceCount = null // 界面上显示「未授权」
}
```

```ts
// ❌ activate 抛错 → 插件整个挂掉
const instances = await api.hostApi.call('instance.list')
```

### 在界面上体现降级

用户看不到「权限没批」这件事，所以你的界面要**自己解释**：

```ts
h('span', null, instanceCount === null
	? '实例数量：未授权读取'
	: `实例数量：${instanceCount}`)
```

官方的 hello-world 示例插件就是这么做的——它声明了 `hostapi:instance.list`（高风险），但把调用包在 `try` 里，未授权时显示「未授权读取」而不是崩掉。

## 事件订阅的降级

`api.events.on(...)` 也会检查权限。没批准时**抛错**：

```ts
try {
	api.events.on('instance', handler)
} catch {
	// 没批准 event:instance，跳过
}
```

不过 `events.on` 是在注册时检查的（不像 `hostApi.call` 是调用时），所以如果权限在 manifest 里声明了、只是用户还没批准，`on` 会抛错——**这个错会让 `activate` 挂掉**。所以要么确保声明了，要么包 `try`。

## 权限声明原则

**只声明你真的会用的。** 每多声明一项高风险权限，用户看到的「这个插件要读我的实例列表」就多一条，装的意愿就低一分。

反过来，**声明了就要用**。声明 `network:example.com` 却从不访问网络，用户会怀疑你在偷偷做别的。

## `settings`

声明式设置项，启动器自动生成表单：

```json
"settings": [
	{
		"key": "refreshInterval",
		"label": "刷新间隔（秒）",
		"description": "主页卡片的刷新频率。",
		"type": "number",
		"default": "30"
	}
]
```

| 字段 | 说明 |
|---|---|
| `key` | 存储键名，不能为空 |
| `label` | 表单上显示的名称 |
| `type` | `text`、`number`、`toggle`、`select` |
| `default` | 默认值，字符串 |
| `options` | `select` 专用；没有会被拒绝 |

读取：

```ts
const interval = Number((await api.settings.get('refreshInterval')) ?? '30')
```

::: tip 设置和 storage 是同一个命名空间
`api.settings.get(key)` 读到的值，和 `api.storage.get(key)` 是**同一个存储**——设置页写的值，你也能用 storage 读。

所以别让设置的 `key` 和你的其他存储键撞名。
:::

详见[设置与存储](/plugin/settings-storage)。

## 校验失败会怎样

manifest 有问题时整个插件不加载，错误显示在设置页：

```
Plugin 'x' is a UI plugin but declares no entry
Plugin 'x' declares an invalid permission 'slot': 'slot' needs a scope, e.g. 'slot:example'
Plugin 'x' has an invalid icon '../icon.png': icon must be a relative path inside the plugin folder
Plugin 'x' needs plugin API version 2, but this launcher supports up to 1
Plugin 'x' setting 'region' is a select but has no options
```

manifest 文件上限 **256 KiB**。

---

接下来：[Vue 与组件](/plugin/vue)。
