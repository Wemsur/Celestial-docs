# 15 分钟：第一个内容源

这一页从空文件夹开始，写出一个**能装进启动器、能搜索、能安装**的内容源。跟着做，中途不需要理解所有细节——细节在后面各页展开。

## 前提

你需要：

- **Node.js 20 以上**（`node -v` 看版本）
- **pnpm**（`pnpm -v`；没有的话 `npm i -g pnpm`）
- 一个**能被访问的网站或 API**，最好是 JSON 的

这一页用一个假想的 `example.com` API。你可以先把代码抄下来跑通，再换成真的。

## 第一步：建目录

内容源**没有官方脚手架命令**，最快的方式是把商店仓库的模板复制一份：

```bash
git clone https://github.com/Wemsur/Celestial-Plugin-Store.git /tmp/store
cp -r /tmp/store/templates/content-source ~/my-content-source
cd ~/my-content-source
pnpm install
```

得到这样一个结构：

```
my-content-source/
├── manifest.json          声明：能做什么、能访问哪些域名
├── src/index.ts           实现
├── types/
│   └── content-source.d.ts   类型定义（从商店 SDK 复制来的副本）
├── vite.config.ts
├── tsconfig.json
├── package.json
└── .github/workflows/
    ├── release.yml        打 tag 时自动构建并发布
    └── sdk-drift.yml      检查类型副本有没有过期
```

::: tip 为什么要有 `types/` 里那份副本
内容源的类型定义**不在 npm 上**。权威版本在商店仓库的 `sdk/index.d.ts`，插件仓库各带一份副本，只服务编辑器的自动补全和类型检查——它**不会进入构建产物**（类型导入在编译时被抹掉）。

副本会过期，所以 `sdk-drift.yml` 工作流会在你推送时比对副本和权威版本，不一致就失败。
:::

## 第二步：写 manifest.json

`manifest.json` 是**启动器唯一读的文件**。它决定你的源叫什么、能做什么、能访问哪些域名。

```json
{
	"id": "example",
	"name": "示例内容站",
	"version": "0.1.0",
	"description": "示例站的模组与资源包。",
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
		"versions": true,
		"resolve_download": true,
		"update_check": false
	},
	"hosts": ["example.com"]
}
```

逐字段的含义：

| 字段 | 说明 |
|---|---|
| `id` | 唯一标识，**同时用作文件夹名**。只能字母、数字、`.`、`-`、`_` |
| `name` | 显示名称 |
| `version` | 语义化版本。**发布时必须和 git tag 一致**（见[发布](/guide/publishing)） |
| `icon` | 你自己目录内的图片路径，如 `icon.png`。**不能是 `..` 或绝对路径** |
| `color` | 主题色 `#rrggbb`，用于卡片左侧渐变、详情页背景、以及没有图标时的降级标记 |
| `detail_format` | `markdown`（默认）或 `text`，决定详情页正文怎么渲染 |
| `api_version` | 契约版本，**当前只能是 `1`** |
| `entry` | 入口 bundle，相对路径 |
| `content_types` | 你提供哪些内容类型（[七个封闭取值](/source/content-types)） |
| `capabilities` | 你实现了哪些功能（见[核心概念](/guide/concepts#能力声明-capabilities)） |
| `hosts` | 你能访问的域名白名单 |

::: danger 三个最容易写错的地方
1. **`capabilities` 里的字段是 snake_case**：`resolve_download`、`update_check`，不是 `resolveDownload`。
2. **`content_types` 用连写的名字**：`resourcepack`、`datapack`，不是 `resource_pack`、`data_pack`。
3. **`id` 就是文件夹名**。启动器把插件装到 `content-sources/<id>/`，所以 `id` 里有 `/` 或 `..` 会被拒绝。
:::

`icon.png` 自己放一张（或者先删掉 `icon` 这一行，启动器会用 `color` 画一个首字母图标）。

## 第三步：写实现

`src/index.ts`：

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
	// 唯一的网络出口。只有 manifest.hosts 里声明过的域名能通。
	async function get<T>(path: string): Promise<T> {
		const response = await api.net.fetch(`https://example.com/api${path}`, {
			headers: { accept: 'application/json' },
		})
		if (!response.ok) {
			throw new Error(`示例站返回 ${response.status}：${path}`)
		}
		return JSON.parse(response.body) as T
	}

	// 把站点的一条数据转成启动器的卡片。这个转换在下面三个方法里都要用。
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

	api.register({
		async search(request: ContentQuery): Promise<ContentPage> {
			const page = await get<any>(
				`/search?q=${encodeURIComponent(request.query ?? '')}` +
					`&page=${request.page}&limit=${request.limit}`,
			)
			return {
				items: page.hits.map((hit: any) => toCard(hit, request.contentType)),
				total: page.total,
			}
		},

		async detail(id: string): Promise<ContentProject> {
			const item = await get<any>(`/item/${encodeURIComponent(id)}`)
			return {
				...toCard(item, 'mod'),
				body: item.body_markdown,
				links: [{ label: '在示例站查看', url: item.url }],
			}
		},

		async resolveDownload(id: string): Promise<DownloadDescriptor> {
			const item = await get<any>(`/item/${encodeURIComponent(id)}`)
			return {
				url: item.download_url,
				fileName: `${item.slug}.jar`,
			}
		},
	})

	api.log('已启动，入口在 example.com')
}
```

### 这段代码在做什么

**`api.net.fetch` 是唯一的网络出口。** 你不能用 `fetch` 或 `XMLHttpRequest`——它们在 webview 里被 CSP 拦着，而且即使能通，请求也不会走启动器的域名白名单。所有请求必须过 `api.net.fetch`，它由 Rust 侧发出，只允许 `hosts` 里的域名。

**`api.register(provider)` 只调用一次。** 传进去的对象里放你声明为 `true` 的方法。

**`resolveDownload` 只返回地址，不下载文件。** 它返回一个描述符 `{ url, fileName }`，启动器拿这个去下载、校验、并按 `content_types` 决定装到哪个目录。

**`api.source.id` 是你 manifest 里的 `id`。** 卡片必须填 `sourceId`，启动器靠它区分内容来自哪个源。

## 第四步：构建

```bash
pnpm build      # 产出 dist/index.js
pnpm typecheck  # 类型检查，可选但推荐
```

产物是 `dist/index.js`——**一个单文件 ES 模块**。内容源没有界面，所以不需要 Vue，也不需要任何垫片。

## 第五步：装进启动器

启动器读的是数据目录下的 `content-sources/<id>/`。把它放进去：

```bash
# Windows（Git Bash / PowerShell）
cp -r . "$APPDATA/CelestialLauncher/content-sources/example"
```

手动操作的话，把**这几个文件**复制到：

```
%APPDATA%\CelestialLauncher\content-sources\example\
├── manifest.json
├── dist\index.js
└── icon.png          ← 如果 manifest 里声明了
```

::: warning 目录名必须等于 manifest 的 `id`
`content-sources/example/` 里的 `example` 必须和 `manifest.json` 的 `id` 完全一致。放错名字，启动器会把它当成另一个源，或者干脆扫不到。

不需要复制 `src/`、`node_modules/`、`tsconfig.json` 这些——启动器只读 `manifest.json` 和它指到的 `entry`。
:::

然后**重启启动器**，打开「设置 → 内容源」，应该能看到它，并且是启用状态。

去浏览页，在侧边栏勾上你的源，搜索点什么。

## 第六步：调试

出问题先看**启动器的日志窗口**。`api.log(...)` 的输出会带上 `[content-source:<id>]` 前缀：

```
[content-source:example] 已启动，入口在 example.com
```

常见的第一批错误：

| 现象 | 原因 |
|---|---|
| 设置页里根本没有这个源 | 目录名和 `id` 不一致，或者 `manifest.json` 不在那一层 |
| 设置页里有，但显示红色错误 | manifest 校验失败，错误文本会写在卡片上 |
| 搜索没反应 | `capabilities.search` 是 `false`，或者 `hosts` 里没有你要访问的域名 |
| 点安装报错 | `resolveDownload` 抛错了，看日志 |
| `Fetch to "..." is not allowed` | 域名没写进 `hosts` |

完整的排查清单见 [FAQ](/faq)。

## 下一步

到这里你有一个能跑的内容源了。接下来按需要深入：

- [manifest.json 字段](/source/manifest) —— 每个字段的完整说明和校验规则
- [网络与 hosts 白名单](/source/network) —— 什么头能带、大小上限
- [七种内容类型](/source/content-types) —— 每种类型的安装行为
- [搜索与浏览](/source/search-browse) —— 排序、卡片字段、分页
- [发布与上架](/guide/publishing) —— 让别人也能装上

想照着真实插件学？[配方](/cookbook/)里有四个官方内容源的逐行拆解。
