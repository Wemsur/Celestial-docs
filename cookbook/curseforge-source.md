# 拆解：CurseForge 源

[celestial-content-curseforge](https://github.com/Wemsur/celestial-content-curseforge) 是**最复杂**的官方内容源——648 行，覆盖五种内容类型，带整合包、国内镜像、中文标签。

它值得完整读一遍，因为把前面所有技巧都用上了，还多了几个独有的问题。

## 它解决什么问题

CurseForge 有正式的 REST API（`api.curseforge.com/v1`），但：

- **需要 API Key**，而且要自己申请。
- **国内访问慢或不稳定**。
- **分类名是英文的**，面向中文用户不友好。
- **整合包的 manifest 里只有项目/文件 id**，没有 URL。

这个源把这些问题都处理了。

## manifest 的取舍

```json
{
	"id": "curseforge",
	"name": "CurseForge",
	"version": "0.1.0",
	"icon": "icon.svg",
	"color": "#f16436",
	"detail_format": "markdown",
	"api_version": 1,
	"entry": "dist/index.js",
	"content_types": ["mod", "modpack", "resourcepack", "shader", "datapack"],
	"capabilities": {
		"search": true,
		"browse": true,
		"detail": true,
		"versions": true,
		"resolve_download": true,
		"update_check": true
	},
	"hosts": [
		"api.curseforge.com",
		"edge.forgecdn.net",
		"mediafilez.forgecdn.net",
		"www.curseforge.com",
		"mod.mcimirror.top"
	],
	"settings": [
		{
			"key": "apiKey",
			"label": "API Key（可覆盖内置值）",
			"description": "留空使用插件内置的 Key。CurseForge 应用内注册可得，格式 $2a$10$ 开头。",
			"type": "text",
			"default": ""
		}
	]
}
```

### 五种内容类型

`content_types` 覆盖了 `mod`、`modpack`、`resourcepack`、`shader`、`datapack`。

CurseForge 用 **class ID** 区分内容类型：

```ts
const CLASS_IDS: Partial<Record<string, number>> = {
	mod: 6,
	resourcepack: 12,
	shader: 6552,
	modpack: 4471,
	datapack: 4545,
}
```

搜索时把启动器的内容类型转成 class ID 传过去。

::: tip 数据包是个例外
数据包在 CurseForge 上不是一个独立的 class——它属于 **Customization (4545)** 下的**一个分类**（category 4780）。

所以数据包搜索要**同时**钉住 class 和 category：

```ts
const DATAPACK_CATEGORY_ID = 4780
```
:::

### 五个 hosts

```json
"hosts": [
	"api.curseforge.com",       // 官方 API
	"edge.forgecdn.net",        // 官方 CDN
	"mediafilez.forgecdn.net",  // 官方 CDN（另一台）
	"www.curseforge.com",       // 站点链接
	"mod.mcimirror.top"         // MCIM 国内镜像
]
```

镜像域名 `mod.mcimirror.top` **必须写进来**，否则镜像请求会被拒。

## 关键代码

### API Key：内置一个，用户可覆盖

```ts
const API_KEY = '$2a$10$...'

async function apiKey(): Promise<string> {
	const override = await api.settings.get('apiKey')
	const key = (override && override.trim()) || API_KEY.trim()
	if (!key) {
		throw new Error('未配置 CurseForge API Key。请在内容源设置里填写，或在插件编译前填入 src/index.ts 的 API_KEY。')
	}
	return key
}
```

::: warning 内置 Key 是「开箱即用」的权衡
把 Key 编译进插件里，用户装上就能用，不用自己去申请。代价是**这个 Key 是公开的**——任何人下载插件都能看到它。

CurseForge 的 Key 有速率限制，所以这是一个「方便 vs 配额」的权衡。用户可以在设置里填自己的 Key 覆盖内置的。

**这是这个插件特有的选择，不是通用做法。** 大多数站点不要内置凭据。
:::

### 镜像：官方失败就改走镜像

```ts
async function request(
	path: string,
	init?: { method?: string; body?: string; mirror?: boolean },
): Promise<SourceFetchResult> {
	const key = await apiKey()
	const url = init?.mirror ? `${MIRROR_BASE}${path}` : `${API_BASE}${path}`
	// ...
}

async function get<T>(path: string): Promise<T> {
	try {
		return JSON.parse((await request(path)).body) as T
	} catch (error) {
		api.log(`官方接口失败，改走 MCIM 镜像：${path}：${String(error)}`)
		return JSON.parse((await request(`/curseforge${path}`, { mirror: true })).body) as T
	}
}
```

::: tip 镜像的路径要加前缀
官方是 `https://api.curseforge.com/v1/mods/123`
镜像 是 `https://mod.mcimirror.top/curseforge/v1/mods/123`

所以 `get()` 里拼的是 `/curseforge${path}`——镜像把 CurseForge 的 API 原样代理在 `/curseforge` 前缀下。

**别自己猜镜像的路径规则**——它不一定是简单的域名替换。
:::

**这不是通用做法。** 大多数站点没有镜像，也不需要。这个插件做镜像是因为 CurseForge 在国内访问确实是个问题。

### 403/401 的错误要特别处理

```ts
if (response.status === 403 || response.status === 401) {
	let detail = response.body.slice(0, 300)
	try {
		const parsed = JSON.parse(response.body) as { error?: string; description?: string; message?: string }
		detail = parsed.description ?? parsed.error ?? parsed.message ?? detail
	} catch {
		// 非 JSON 响应体（例如 Cloudflare 拦截页）原样截断展示
	}
	throw new Error(
		`CurseForge 拒绝了请求（${response.status}）。已发送长度 ${key.length} 的 Key。响应：${detail || '(空)'}`,
	)
}
```

403 在这里几乎总是「Key 不对或过期」，而**通用错误信息看不出来**。所以：

1. 把**发送的 Key 长度**写进错误——用户能看出是不是空的。
2. 把**响应体原文**带上——CurseForge 会说清楚原因。
3. 响应体不是 JSON（比如 Cloudflare 拦截页）时**原样截断**展示——那本身也是有用的信息。

::: danger 别把完整的 Key 打出来
这里只打印**长度**和**开头几位**（`key.slice(0, 6)`）。日志会给用户看、会被贴到 issue 里，**完整凭据不能进日志**。

日志里的东西要当作公开的。
:::

### 拆分游戏版本和加载器

```ts
function splitGameVersions(values: string[] | undefined): {
	gameVersions: string[]
	loaders: string[]
} {
	const gameVersions: string[] = []
	const loaders: string[] = []
	for (const value of values ?? []) {
		const loader = LOADER_NAMES[value.trim().toLowerCase()]
		if (loader) {
			if (!loaders.includes(loader)) loaders.push(loader)
		} else if (/^\d/.test(value.trim()) && !gameVersions.includes(value)) {
			gameVersions.push(value)
		}
	}
	return { gameVersions, loaders }
}
```

CurseForge 的 `gameVersions` 数组混着三样东西：

```ts
['Client', 'NeoForge', 'Server', '26.3']
//  ↑ 环境    ↑ 加载器   ↑ 环境  ↑ 版本号
```

所以**分拣**：

- 认识的名字（在 `LOADER_NAMES` 里）→ `loaders`。
- 以数字开头的 → `gameVersions`。
- 其余的（`Client`、`Server`）→ **丢弃**。

::: tip `/^\d/` 这个判断很实用
「以数字开头」是区分「版本号」和「环境标签」的一个便宜而有效的启发式。

它不是完美的（如果哪天出现以数字开头的加载器名就错了），但比列白名单简单，而且这里的失败模式是「多一个版本标签」，无害。
:::

`LOADER_NAMES` 把 CurseForge 的拼写映射到启动器的：

```ts
const LOADER_NAMES: Record<string, string> = {
	forge: 'forge',
	neoforge: 'neoforge',
	fabric: 'fabric',
	quilt: 'quilt',
	liteloader: 'liteloader',
	rift: 'rift',
}
```

### 版本号只取可读的那部分

```ts
/**
 * CurseForge authors write `displayName` as "<version> for <loader> <game
 * version>" — "31.10.0.63 for NeoForge 26.3". Everything after " for " is
 * already shown in the table's own Platform and Game version columns, so the
 * version cell wants only the head. The numeric file id is *not* a version
 * number; it is only an id, and showing it made every row read as a serial.
 */
function versionLabel(file: CfFile): string {
	const head = (file.displayName ?? '').split(/\s+for\s+/i)[0]?.trim()
	return head || String(file.id)
}
```

CurseForge 的文件名约定是 `<版本> for <加载器> <游戏版本>`：

```
31.10.0.63 for NeoForge 26.3
```

表格的「平台」和「游戏版本」列**已经显示了后半段**，所以版本列只要前半段。

::: danger 直接用 file.id 会让整个表格读起来像序列号
CurseForge 的 `file.id` 是 `9115761` 这样的数字——那是**文件 id，不是版本号**。

如果 `versionNumber` 填了它，用户看到的版本列全是 `9115761`、`9115762`……完全看不懂。

`safeFileName` 式的兜底（`head || String(file.id)`）只在 `displayName` 为空时才用 id——那是没有更好选择的情况。
:::

### 整合包：分块批量解析

这是整个源最复杂的部分。CurseForge 整合包的 manifest 里，文件只有 id：

```json
{
	"minecraft": { "version": "1.20.1", "modLoaders": [{ "id": "neoforge-21.1.0", "primary": true }] },
	"files": [
		{ "projectID": 238222, "fileID": 4567890, "required": true },
		{ "projectID": 306612, "fileID": 4567891, "required": true }
	]
}
```

要把 `fileID` 换成下载 URL，得调 CurseForge 的**批量文件接口**。

```ts
const fileIds = manifest.files.map((file) => file.fileID)
const CHUNK = 100
for (let start = 0; start < fileIds.length; start += CHUNK) {
	const chunk = fileIds.slice(start, start + CHUNK)
	const payload = await request('/v1/mods/files', {
		method: 'POST',
		body: JSON.stringify({ fileIds: chunk }),
	})
	// ...
}
```

::: warning 必须分块
一个整合包可能有**几百个**文件。一次请求传几百个 id 会超过服务端限制（也可能被 CDN 拒绝）。

`CHUNK = 100` 是保守的选择。分块后循环请求。

**注意请求体是 `{ fileIds: [...] }` 而不是 `[{ projectID, fileID }]`。** CurseForge 的这个接口只接受文件 id 数组——这是很容易写错的地方（写错了会得到 415 或 400）。
:::

### 禁止第三方下载的文件要跳过，不能中断

```ts
for (const file of answered.data ?? []) {
	answeredIds.add(String(file.id))
	if (!file.downloadUrl) {
		try {
			const mirrored = JSON.parse(
				(await request(`/curseforge/v1/mods/${file.modId}/files/${file.id}`, { mirror: true })).body,
			) as { data: CfFile }
			file.downloadUrl = mirrored.data.downloadUrl
		} catch (error) {
			api.log(`镜像未能解析 ${file.fileName}：${String(error)}`)
		}
	}
	// A file whose author forbade third-party downloads has no URL from either
	// endpoint. One such file must not cost the reader the whole pack, so it is
	// skipped and named in the launcher log.
	if (!file.downloadUrl) {
		skipped.push(file.fileName)
		api.log(`跳过无法下载的文件（作者禁止第三方下载）：${file.fileName}`)
		continue
	}
	// ...
}
```

::: danger 这是整合包安装最容易踩的坑
有些模组作者**禁止第三方下载**——CurseForge 对这类文件不返回 `downloadUrl`。

如果插件遇到一个就抛错，**整个整合包都装不了**。正确的做法是：

1. **跳过**这个文件。
2. **记下它的名字**（`skipped` 数组）。
3. **继续装其余的**。
4. 在日志里告诉用户哪些文件被跳过了，让他自己去 CurseForge 手动下。

注释说得很清楚：*One such file must not cost the reader the whole pack.*
:::

### 镜像补下 URL

注意上面那段里，官方接口没给 `downloadUrl` 时，插件**先试试镜像**：

```ts
const mirrored = JSON.parse(
	(await request(`/curseforge/v1/mods/${file.modId}/files/${file.id}`, { mirror: true })).body,
) as { data: CfFile }
file.downloadUrl = mirrored.data.downloadUrl
```

有些文件官方接口不给 URL，但镜像能拿到。所以「官方没有 → 试镜像 → 还是没有 → 跳过」是三级降级。

### 加载器 id 的解析

```ts
function parseLoader(loaders: { id: string; primary?: boolean }[]): { ... } {
	// manifest.minecraft.modLoaders 里是 "neoforge-21.1.0" 这种连写形式
}
```

`modLoaders[].id` 是 `neoforge-21.1.0` 这样的形式，要拆成 `{ loader: 'neoforge', version: '21.1.0' }`。

::: warning `neoforge` 是一个词
拆的时候按**第一个连字符**拆，别按「neo + forge」拆。

`neoforge-21.1.0` → `['neoforge', '21.1.0']` ✅
:::

### 中文标签

```ts
const CATEGORY_ZH: Record<string, string> = {
	'4069': '世界生成',
	'4068': '生物',
	// ...
}

function categoryLabel(name: string): string {
	return api.i18n.locale.toLowerCase().startsWith('zh') ? CATEGORY_ZH[name] ?? name : name
}
```

CurseForge 的分类名是英文的。这个源带了一张中文对照表，按用户的语言切换。

::: tip id 不翻译，只有 label 翻译
分类的 **id**（`4069`）是回传给 CurseForge API 做筛选的，**必须保持原样**。翻译的只有显示名。

`CATEGORY_ZH[name] ?? name` 的兜底——没有译文的用英文原名，不会变成空白。
:::

## 小结：这篇教了什么

| 技巧 | 用在什么场合 |
|---|---|
| class ID 映射内容类型 | 站点用自己的分类体系 |
| 一个类型是「某个 class 下的分类」 | 站点的层级和你的不一样 |
| 内置 Key + 用户覆盖 | 开箱即用的权衡 |
| 镜像降级 | 站点在某地区访问不稳 |
| 镜像路径要加前缀 | 别猜镜像的路径规则 |
| 403 专门处理 + 打印 Key 长度 | 诊断认证问题 |
| 凭据不进日志（只打长度） | 日志是公开的 |
| `/^\d/` 分拣版本号 | 站点字段混了多种值 |
| 版本号只取可读部分 | 站点字段里混了展示文本 |
| 分块批量请求 | 请求体有大小限制 |
| 单个文件失败不中断整包 | 整合包安装 |
| 三级降级（官方→镜像→跳过） | 数据源不可靠 |
| 中文对照表 + 兜底 | 面向中文用户 |

---

接下来：[拆解：一言插件](/cookbook/hitokoto-plugin)。
