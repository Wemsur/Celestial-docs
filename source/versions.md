# 版本列表

`versions` 提供项目的版本表——用户点「版本」标签页看到的那个表格。它和 Modrinth 项目页用的是同一个组件，所以列、筛选、分页、右键菜单的行为完全一致。

```ts
async versions(id: string, request: ContentQuery): Promise<ContentVersion[]>
```

## 返回对象

```ts
{
	id: string // 版本 id，之后会传回 resolveDownload 的 versionId
	name?: string
	versionNumber?: string // 表格「版本」列显示的就是它
	gameVersions?: string[]
	loaders?: string[]
	publishedAt?: string // ISO 8601
	downloads?: number
	channel?: string // 'release' | 'beta' | 'alpha'
	body?: string // 更新日志
	url?: string // 该版本在你站点的页面
	files?: ContentFile[] // 一个版本有多个文件时列出，让用户选
}
```

## 哪些字段要填好

| 字段 | 影响 |
|---|---|
| `id` | **必须稳定**。安装时它会作为 `versionId` 传回 `resolveDownload` |
| `versionNumber` | 表格里显示的主标题。**别用内部数字 id** |
| `channel` | 决定版本类型的标签颜色（`release` / `beta` / `alpha`） |
| `gameVersions` / `loaders` | 安装时筛选兼容实例 |
| `files` | 一个版本有多个文件时，让用户挑 |

::: danger `versionNumber` 别填成一串数字 id
CurseForge 的版本号字段长得像 `9115761`（内部 file id），而真正给人看的是 `31.10.0.63`。表格里显示前者会让用户完全看不懂。

官方的 CurseForge 源在插件里做了拆分：从文件名的 `xxx for yyy` 里取后面那段当 `versionNumber`：

```ts
// 大意
function versionLabel(file) {
	// "31.10.0.63 for Minecraft 1.20.1" → "31.10.0.63"
	const parts = file.displayName.split(/\s+for\s+/i)
	return parts[0] || file.fileName
}
```

**表格显示的是 `versionNumber`。** 填错了，用户看到的就是一串没有意义的数字。
:::

## 加载器与游戏版本的拼写

`loaders` 要用**启动器的拼写**，不是站点自己的：

| 启动器 | 站点可能叫 |
|---|---|
| `forge` | `Forge`、`forge` |
| `fabric` | `Fabric`、`fabric` |
| `neoforge` | `NeoForge`、`neo` |
| `quilt` | `Quilt` |
| `vanilla` | 无加载器 |

游戏版本用标准写法：`1.20.1`、`1.21`。别写 `1.20.x` 或 `1.20.1-forge`。

::: tip 站点的加载器列表里混了别的东西
CurseForge 的 `gameVersions` 数组长这样：`['Client', 'NeoForge', 'Server', '26.3']`——里面有 `Client`/`Server` 这种非加载器的值，也有 `26.3` 这种不是 MC 版本的快照号。

官方的做法是**分拣**：看起来像游戏版本的放 `gameVersions`，认识的名字放 `loaders`，其余丢弃。写在插件里：

```ts
const LOADER_NAMES = ['forge', 'fabric', 'neoforge', 'quilt', 'vanilla']

function splitGameVersions(values: string[]) {
	const gameVersions: string[] = []
	const loaders: string[] = []
	for (const value of values) {
		if (LOADER_NAMES.includes(value.toLowerCase())) loaders.push(value.toLowerCase())
		else if (/^\d+\.\d+(\.\d+)?$/.test(value)) gameVersions.push(value)
		// 其余（Client / Server / 26.3 之类）直接丢掉
	}
	return { gameVersions, loaders }
}
```
:::

## 多文件版本（`files`）

有些版本的下载不止一个文件——比如一个 GitHub Release 里每个加载器一个 asset。这时**列出来让用户挑**，而不是你自己默默挑一个：

```ts
files: [
	{ id: 'fabric', name: 'example-fabric-1.0.jar', size: 123456 },
	{ id: 'forge', name: 'example-forge-1.0.jar', size: 124000 },
]
```

`id` 是**你自己的文件 id**，用户选了之后会传回：

```ts
async resolveDownload(id, versionId, fileId) {
	// fileId 就是用户在上面 files 里挑的那个的 id
}
```

不填 `files` 时，用户看不到文件选择，直接走 `resolveDownload`（`fileId` 为 `undefined`）。

::: warning 什么时候该用 files
**当版本真的有多个有意义的选择时。** 如果只是「一个 jar」，不填 `files` 更简单。

GitHub 源是个典型例子：一个 Release 可能有多个 asset，靠正则猜容易猜错，所以列出来让用户选。官方 GitHub 源就是这么做的——它让用户配置匹配规则，但最终把候选列出来。
:::

## 更新日志（`body`）

按 manifest 的 `detail_format` 渲染（和详情页正文一样）。可选。

## 版本页面

用户点表格里的一行会打开**版本详情页**。这个页面的样式和逻辑与 Modrinth 的版本页**完全相同**——用的是同一个共享组件。所以你能提供的字段（`body`、`gameVersions`、`loaders`、`files`、`url`）会以相同方式呈现。

`url` 是「这个版本在你站点的页面」，会显示为一个「打开原页面」的入口。

## 完整例子

```ts
async versions(id: string, request: ContentQuery): Promise<ContentVersion[]> {
	const data = await get<any>(`/item/${encodeURIComponent(id)}/versions`)

	return data.versions.map((version: any) => {
		const { gameVersions, loaders } = splitGameVersions(version.game_versions ?? [])
		return {
			id: String(version.id),
			name: version.name,
			versionNumber: version.version_number,
			gameVersions,
			loaders,
			publishedAt: version.created_at,
			downloads: version.download_count,
			channel: version.release_type, // 'release' | 'beta' | 'alpha'
			body: version.changelog,
			url: `https://example.com/item/${id}/version/${version.id}`,
		}
	})
}
```

## 没有版本的概念怎么办

如果站点没有「版本」这一层（比如地图站，一张图就是一个文件），**声明 `versions: false`**，表格就不显示。

官方的像素茶艺源就是这样——地图站没有版本，所以：

```json
"capabilities": { "versions": false, ... }
```

这时详情页直接给一个安装按钮，不需要选版本。

---

接下来：[下载地址](/source/resolve-download)。
