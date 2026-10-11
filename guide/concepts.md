# 核心概念

这一页把后面反复出现的词一次性讲清楚。看不懂的地方先跳过，用到时再回来。

## 能力声明（capabilities）

内容源的 manifest 里有一个 `capabilities` 对象，每一项是 `true` 或 `false`：

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

它的意思是「**我实现了哪些功能**」。启动器只调用你声明为 `true` 的那些方法。

**声明 `false` 不是错误，只是降级。** 一个没有 `resolve_download` 的内容源照样能浏览，只是它的安装按钮会不可用（而不是点了报错）。官方 MC百科源就是这样：它能搜索、能看详情，但站点的下载要过人机验证，所以 `resolve_download: false`，详情页给一个「前往本站」的链接。

::: danger 反过来的错误很常见
**别声明你实现不了的能力。** 声明 `resolve_download: true` 却返回不了地址，用户看到的是点了安装之后弹一个错误，而不是按钮从一开始就灰掉。前者是 bug，后者是设计。
:::

字段名**全部是 snake_case**：

| 能力 | 对应你实现的方法 | 声明为 `false` 的后果 |
|---|---|---|
| `search` | `search(request)` | 搜索框对这个源不起作用 |
| `browse` | `browse(request)` | 不带关键词浏览时不列出你的内容 |
| `detail` | `detail(id)` | 点进去没有详情内容 |
| `versions` | `versions(id, request)` | 版本标签页不显示 |
| `resolve_download` | `resolveDownload(id, versionId?, fileId?)` | 安装按钮不可用 |
| `update_check` | `checkUpdate(items)` | 不参与更新检查 |

注意最后一列的**方法名是 camelCase**（`resolveDownload`），而 **manifest 里的字段名是 snake_case**（`resolve_download`）。这两处不一样，是最容易写错的地方之一。

## provider

你的内容源在 `activate()` 里调用一次 `api.register(provider)`，`provider` 是一个对象，里面的方法就是你声明为 `true` 的那些：

```ts
export async function activate(api: ContentSourceApi) {
  api.register({
    async search(request) { /* ... */ },
    async browse(request) { /* ... */ },
    async detail(id) { /* ... */ },
  })
}
```

启动器拿到这个对象后，会**只调用你声明过的**方法。你实现了 `detail` 但声明 `detail: false`，那 `detail` 永远不会被调用——不报错，只是白写。

## hosts 白名单

内容源**不能自己发网络请求**。它的 `fetch` 受启动器 CSP 限制，所有请求必须走：

```ts
await api.net.fetch(url, { headers })
```

而启动器会**拒绝任何不在 manifest `hosts` 里的域名**：

```json
"hosts": ["example.com", "*.example.com", "cdn.example.com"]
```

这是硬校验，在 Rust 侧做的，绕不过去。

为什么要有它：内容源是第三方代码，用户装的时候只看到「这个源能访问 example.com」。如果它能访问任意域名，那「它会不会把我的 token 发到别处」就无法回答了。

写 `hosts` 的原则是**只写你真的需要的**：

```json
// ✅ 精确
"hosts": ["api.github.com", "github.com", "objects.githubusercontent.com"]

// ❌ 图省事写通配
"hosts": ["*"]
```

`*.example.com` 只匹配一级子域（`a.example.com` 匹配，`a.b.example.com` 不匹配）。

## 内容类型（content types）

启动器的**封闭取值**，一共七个：

| 取值 | 含义 | 启动器把它装到哪 |
|---|---|---|
| `mod` | 模组 | 实例的 `mods/` |
| `modpack` | 整合包 | **新建一个实例** |
| `resourcepack` | 资源包 | 实例的 `resourcepacks/` |
| `shader` | 光影 | 实例的 `shaderpacks/` |
| `datapack` | 数据包 | 实例的 `datapacks/` |
| `world` | 世界（地图） | 实例的 `saves/`，**永不覆盖，每次新建副本** |
| `skin` | 皮肤 | 启动器数据目录的 `skins/`，**不属于任何实例** |

你的 manifest 用 `content_types` 声明你提供哪些，启动器的对应标签页就会把你列进去。

两个语义特殊的：

- **`world` 永远不覆盖。** 玩家在自己的存档里建了东西，装地图不能把它删了。所以每次安装都在 `saves/` 下新建一个带序号的名字。你不需要做任何事，但要知道用户装了两次会得到两个存档。
- **`skin` 不属于实例。** 它存在启动器自己的目录里，在皮肤页显示。装皮肤时不需要选实例。

## 源倍率（multiplier）

浏览页会把**所有源的内容合并成一个列表**排序。问题是：Modrinth 上一个热门模组有几十万下载，一个小站点最好的内容可能只有几千。直接比数字，小站点永远排不上来。

所以启动器给每个源乘一个**倍率**再排序：

```
排序用的下载量 = 你报告的 downloads × 这个源的倍率
```

倍率由**用户**在设置里调，不是你定的。你只需要如实报告原始下载量，不要自己放大数字——放大了就变成了在骗用户调出来的倍率。

## 提议 vs 放置

这是整个内容源系统的核心约束，值得单独记：

> **内容源只能提议内容，不能放置内容。**

它给地址，启动器负责下载、校验、决定目录、处理覆盖。SDK 的注释里写作 *a source can propose content, never place it*。

具体到代码：`resolveDownload()` 返回的是一个**描述符**，不是文件：

```ts
{ url, headers?, fileName?, hash? }
```

你永远拿不到「把文件写进磁盘」的能力。

## 权限（UI 插件）

UI 插件的 manifest 里是 `permissions` 数组，不是 `capabilities`：

```json
"permissions": ["style", "storage", "slot:sidebar.top", "network:example.com"]
```

每项是 `kind` 或 `kind:scope`。低风险的装上即生效，高风险的等用户批准：

| 风险 | 权限 |
|---|---|
| 低（自动授予） | `style`、`storage`、`slot:<位置>`、`route`、`event:<类型>` |
| 高（需用户批准） | `network:<域名>`、`region:<区域>`、`hostapi:<名称>`、`sidecar`、`lan` |

未批准的权限**被调用时抛错**，而不是静默失效。所以你要 `try/catch` 并优雅降级。

## 生命周期

内容源和 UI 插件都是同一个形状：

```ts
export async function activate(api) {
  // 启动器加载你的 bundle 后调用一次
  // 在这里注册一切
}
```

要点：

- **只调用一次。** 启动器不会重复调用，也不保证什么时候调用（UI 插件是在应用渲染完之后）。
- **可以是 async。** 启动器会 `await` 它，所以在这里 `await api.net.fetch(...)` 是安全的。
- **没有 `deactivate`。** 卸载时启动器自己清理：插件的存储保留（用户可以选择一并删除），事件订阅和 sidecar 自动销毁。
- **抛错不会静默。** 如果 `activate` 抛错，这个插件会被标记为「启动失败」，错误显示在设置页里，插件的其余部分不工作。所以别把高风险调用放在顶层不包 `try`。

---

现在可以动手了：[第一个内容源](/guide/getting-started-source)。
