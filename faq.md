# FAQ

按**报错信息**和**症状**查。每条给出原因和解法。

## manifest 相关

### `manifest.json is not valid: unknown variant \`resource_pack\``

**原因**：`content_types` 里的拼写错了。启动器的取值是**连写**的。

**解法**：用 `resourcepack`、`datapack`（不是 `resource_pack`、`data_pack`）。

正确的七个取值：`mod`、`modpack`、`resourcepack`、`shader`、`datapack`、`world`、`skin`。

### `Invalid content source id '...': use letters, digits, '.', '-' or '_'`

**原因**：`id` 里有非法字符。`id` 会被当作**目录名**用。

**解法**：只用字母、数字、`.`、`-`、`_`。不能以 `.` 开头或结尾，不能含 `..`，最长 128 字符。

### `Content source 'x' needs content-source API version 2, but this launcher supports up to 1`

**原因**：manifest 的 `api_version` 高于启动器支持的版本。

**解法**：把 `api_version` 改成 `1`。（如果你确实需要更高的版本，说明启动器该升级了。）

### `Content source 'x' declares an invalid icon '../icon.png'`

**原因**：`icon` 必须是**你插件目录内的相对路径**。

**解法**：用 `icon.png` 或 `assets/icon.png`，不要用 `..` 或绝对路径。

### `Plugin 'x' declares an invalid permission 'slot': 'slot' needs a scope`

**原因**：`slot`、`event`、`network`、`region`、`hostapi` 这几类**必须带 scope**。

**解法**：写成 `slot:sidebar.top`。

### `Plugin 'x' declares an invalid permission 'style:global': 'style' does not take a scope`

**原因**：反过来的错误——`storage`、`style`、`route`、`sidecar`、`lan` **不能带 scope**。

**解法**：写成 `style`。

### `Plugin 'x' setting 'region' is a select but has no options`

**原因**：`type: "select"` 的设置项必须有 `options`。

**解法**：补上 `options` 数组，或者把 `type` 改成 `text`。

### 设置页里根本没有我的插件

**原因**：目录名和 `id` 不一致，或者 `manifest.json` 不在插件根那一层。

**解法**：确认目录结构是 `plugins/<id>/manifest.json`（内容源是 `content-sources/<id>/manifest.json`）。**哪个文件夹里有 `manifest.json`，那个就是插件根。**

### 改了 manifest 没生效

**原因**：manifest 在插件加载时读一次。

**解法**：重启启动器，或者在设置页重新加载插件。

## 内容源：网络

### `Content source 'x' did not declare access to 'api.foo.com'`

**原因**：请求的域名不在 manifest 的 `hosts` 里。

**解法**：把那个域名加进 `hosts`。注意**精确匹配**——`example.com` 不匹配 `api.example.com`。

### `Fetch to "..." is not allowed`

同上。看日志里被拒的**完整 URL**，把它的域名加进 `hosts`。

### 下载失败，但域名明明在 hosts 里

**原因**：下载 URL **重定向**到了另一个域名。

**解法**：看日志里重定向的目标域名，把它也加进 `hosts`。GitHub 的 Release 下载会重定向到 `objects.githubusercontent.com` / `release-assets.githubusercontent.com`。

### `Response is larger than 16 MiB`

**原因**：`api.net.fetch` 的响应体有 16 MiB 上限。

**解法**：**别用 `api.net.fetch` 下载文件。** 在 `resolveDownload()` 里返回 URL，让启动器去下（它有流式下载和进度条）。

### 站点要求看起来像浏览器

**解法**：在 `api.net.fetch` 的 `headers` 里带 `referer` 和 `user-agent`——这两个头是允许的。

```ts
await api.net.fetch(url, {
	headers: {
		referer: 'https://example.com/',
		'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
	},
})
```

## 内容源：功能

### 搜索框对我的源不起作用

**原因**：`capabilities.search` 是 `false`。

**解法**：实现 `search()` 并把 `capabilities.search` 改成 `true`。

### 点安装报错

**原因**：`resolveDownload()` 抛错了。

**解法**：看日志。常见的是域名没在 `hosts` 里，或者 API 返回了意外的结构。

### 安装按钮是灰的

**原因**：`capabilities.resolve_download` 是 `false`。

**解法**：如果你想支持安装，实现 `resolveDownload()` 并声明 `true`。如果**本来就不能装**（像 MC百科那样），这是**正确行为**——按钮不可用比点了报错好。

### 声明了 `resolve_download: true` 但启动器不调用

**原因**：很可能写成了 camelCase `resolveDownload`。

**解法**：manifest 里的**字段名全是 snake_case**（`resolve_download`、`update_check`），而 **provider 的方法名是 camelCase**（`resolveDownload`、`checkUpdate`）。这两处不一样。

写成 camelCase 不会报错——JSON 里多一个没人读的字段——但那个能力会被当成 `false`。这是最难发现的错误。

### 版本表里显示的是 `9115761` 这样的数字

**原因**：`ContentVersion.versionNumber` 填了站点的内部文件 id。

**解法**：填**给人看的版本号**。CurseForge 的文件名约定是 `31.10.0.63 for NeoForge 26.3`——取 `for` 前面那段。

```ts
function versionLabel(file) {
	const head = (file.displayName ?? '').split(/\s+for\s+/i)[0]?.trim()
	return head || String(file.id)
}
```

### 侧边栏出现两个「分类」

**原因**：`filters()` 返回的 `header` 没写成内置的名字。

**解法**：用 `header: 'categories'`（内置的还有 `features`、`performance impact`），选项会**合并进**那一个分组。其他 header 单独成组。

### 勾选筛选没反应

**原因**：没读 `request.filters`，或者键名和 `filters()` 里给的组 `id` 对不上。

**解法**：`request.filters` 的键是**组的 id**，值是**勾选的选项 id 数组**：

```ts
const selected = request.filters?.category // 组 id 是 'category'
```

### 切换语言后筛选失灵

**原因**：把选项的 `id` 也翻译了。

**解法**：**只有 `label` 该翻译**，`id` 必须稳定（用站点自己的数字 id）。

### 详情页正文显示成一坨纯文本

**原因**：`detail_format` 是 `text`，但站点给的是 Markdown。

**解法**：改成 `"detail_format": "markdown"`。

### 正文里出现 `[b]标题[/b]` 这种字符

**原因**：站点用的是 BBCode 或自己的方言，标准 Markdown 渲染器不认。

**解法**：在插件里**先转成 Markdown** 再返回。见[像素茶艺的方言转换](/cookbook/pixelmap-source#正文的方言转换)。

### 详情页图片裂开

**原因**：图片域名不在 `hosts` 里。启动器的通用图片代理会把它转发到 `wsrv.nl`，而站点的 CDN 经常防盗链，取不到。

**解法**：把**图片域名**也加进 `hosts`。

```json
"hosts": ["example.com", "oss.example.com"]
```

### 内容出现在错误的标签页

**原因**：卡片里 `contentType` 写死了。

**解法**：用 `request.contentType`，不要写 `'mod'`。

### 卡片被合并进了别的源的内容

**原因**：合并按「内容类型 + 名字（归一化后）」匹配。你的内容和另一个源的某个内容**名字一样**。

**解法**：通常是**好事**（用户在任意一个源都能找到）。如果确实不该合并，把名字写得独特一些。

## 内容源：整合包

### 装完是空实例

**原因**：`resolveModpack()` 返回的 `files` 是空数组，或者全被过滤掉了。

**解法**：检查过滤条件——**`required: true` 的文件不能漏**。

### `resolveModpack` 没被调用

**原因**：manifest 的 `content_types` 里没有 `modpack`。

### 装了不该有的模组

**原因**：返回了 `required: false` 的文件。

**解法**：整合包的 manifest 里每个文件有 `required` 字段，**只处理 `true` 的**。

### 部分文件下载失败，整个整合包装不了

**原因**：某个文件作者**禁止第三方下载**，CurseForge 不返回 `downloadUrl`。

**解法**：**跳过它，不要中断整包**。

```ts
if (!file.downloadUrl) {
	skipped.push(file.fileName)
	api.log(`跳过无法下载的文件：${file.fileName}`)
	continue
}
```

### 实例建了但启动报缺加载器

**原因**：`loader` 或 `loaderVersion` 不对。

**解法**：`loader` 必须是 `vanilla` / `forge` / `neoforge` / `fabric` / `quilt` 之一。`neoforge` 是**连写的一个词**。

## UI 插件：权限

### `Plugin "x" cannot use slots: the "slot:sidebar.top" permission has not been granted`

**原因**：manifest 里没声明这项权限，或者声明了但用户在设置页没批准。

**解法**：在 `permissions` 里加上。如果是高风险权限，用户还要手动批准——**你的代码要能优雅降级**。

### 插件整个不工作 / 显示「启动失败」

**原因**：`activate()` 抛错了。最常见的是**高风险权限调用没有包 `try`**。

**解法**：看错误文本（会指出是哪一行）。把可能因权限失败而抛错的调用包起来：

```ts
try {
	const instances = await api.hostApi.call('instance.list')
} catch {
	// 未授权，降级
}
```

### `Plugin "x" cannot listen to "instance": the "event:instance" permission has not been granted`

**原因**：`api.events.on` 在**注册时**就检查权限。

**解法**：manifest 里声明 `event:instance`。声明了但用户没批准的话，`on` 也会抛——所以要包 `try`。

### `Unknown host API "something.else"`

**原因**：宿主接口是白名单，只有四个：`instance.list`、`instance.get`、`library.list`、`auth.default_username`。

### `This plugin cannot access region "topbar": ... has not been granted`

**原因**：没声明 `region:topbar`，或用户没批准。

### `Region "topbar" is not on screen.`

**原因**：当前页面不渲染这个区域（比如全屏的启动页）。

**解法**：不要在 `activate()` 里无条件取区域，包 `try` 或者在需要时再取。

## UI 插件：界面

### `Route path "/plugin/foo" is already taken`

**原因**：用了启动器保留的路径。

**解法**：用 `/plugins/<你的id>` 这个前缀。注意 `/plugin/`（启动器保留）和 `/plugins/`（给你的）一字之差。

### `A route needs an absolute path starting with "/"`

**原因**：`path` 没以 `/` 开头。

### `Slot "..." is already taken by this plugin`

**原因**：同一个插槽里用了重复的 `id`。

**解法**：换一个 `id`。不同插件之间不冲突。

### `Unknown slot "sidebar-top"`

**原因**：插槽 id 拼错了。

**解法**：用点号分隔——`sidebar.top`，不是 `sidebar-top`。完整清单见[插槽清单](/reference/slots)。

### 插件加载失败，产物里有裸的 `import 'vue'`

**原因**：`build/celestial-vue.mjs` 的别名没生效。

**解法**：确认 `vite.config.ts` 里有 `alias: [celestialVueAlias(projectRoot)]`。自查：

```bash
grep -c 'from"vue"\|from '"'"'vue'"'"'' dist/index.js
```

结果必须是 **0**。

### 组件挂上了但界面不更新

**原因**：插件自己打包了一份 Vue，或者用了 `render` 返回的 DOM（不受响应式管理）。

**解法**：确保 Vue 被别名替换（见上）。优先用 `component` 而不是 `render`。

### 渲染函数不更新

**原因**：`setup()` 里 `return h(...)` 而不是 `return () => h(...)`。

**解法**：渲染函数必须**返回一个函数**。

## UI 插件：sidecar / LAN

### `Sidecar 'x' is not installed`

**原因**：没先 `ensure`，或者 key 不一致。

### `ensure` 下载被拒

**原因**：下载 URL 的域名不在 `network:` 权限里。

**解法**：manifest 里加上 `network:<下载域名>`。

### `start()` 返回的 `port` 是 `null`

**原因**：没传 `portFile: true`，或者 sidecar 没按约定往端口文件写 `{"port": N}`。

### sidecar 启动就退出

**原因**：平台/架构不对（下错了文件），或者文件没有可执行权限。

**解法**：检查 `api.platform.os` 和 `api.platform.arch`，下载对应平台的构建。

### `LAN announce port must not be zero`

**原因**：`announce` 的端口传了 0。

### 局域网里看不到世界

**原因**：防火墙挡了 UDP 4445，或者不在同一网段。

**解法**：检查防火墙。这个能力用的是 UDP 多播 `224.0.2.60:4445`，很多防火墙默认拦截。

### motd 里的方括号没了

**不是 bug**。广播包用 `[MOTD]...[/MOTD]` 分隔，名字里的方括号会破坏格式，所以启动器自动删掉。

## 调试通用

### 日志在哪

**启动器的日志窗口**。两种插件的输出都带前缀：

```
[content-source:example] ...
[plugin:com.example.my-plugin] ...
```

### 怎么知道实际请求了哪些域名

看日志里的域名拒绝信息，它会打印**被拒的完整 URL**。

### 卸载后数据还在

**不是 bug**。卸载时可以选择是否一并删除数据。不删的话，重装能恢复（这对用户填过的 token 很重要）。

---

还有问题？去[插件商店仓库](https://github.com/Wemsur/Celestial-Plugin-Store)开个 Issue。
