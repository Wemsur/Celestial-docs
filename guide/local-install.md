# 装进启动器调试

这一页讲怎么在本地反复改代码、快速看到效果，以及出问题时从哪里找原因。

## 插件装在磁盘上的位置

启动器读两个目录，都在它的数据目录下：

| 插件类型 | 目录 |
|---|---|
| 内容源 | `<数据目录>/content-sources/<id>/` |
| UI 插件 | `<数据目录>/plugins/<id>/` |

数据目录按平台：

| 平台 | 路径 |
|---|---|
| Windows | `%APPDATA%\CelestialLauncher\` |
| macOS | `~/Library/Application Support/CelestialLauncher/` |
| Linux | `~/.config/CelestialLauncher/`（或 `$XDG_CONFIG_HOME`） |

::: danger 目录名必须等于 manifest 的 `id`
`content-sources/example/` 里的 `example`，必须和 `manifest.json` 的 `"id": "example"` 完全一致。

不一致的后果是启动器扫不到它，或者把它当成另一个插件。`id` 里不允许 `/`、`..`、开头或结尾的 `.`。
:::

**插件根就是「哪个文件夹里有 `manifest.json`」那个文件夹。** `entry` 相对它解析。别把 `dist/` 当成插件根。

## 最小安装：手动复制

不需要任何工具。构建完，把需要的文件复制过去：

```bash
# 内容源
pnpm build
cp manifest.json dist/index.js icon.png \
  "$APPDATA/CelestialLauncher/content-sources/example/"
```

::: tip 少复制点东西
启动器只读 `manifest.json` 和它 `entry` 指到的文件（加上 `icon`）。`src/`、`node_modules/`、`tsconfig.json` 都不需要。

不过源码放着也无妨，有些插件作者习惯把整个目录复制过去，方便对照。
:::

然后**重启启动器**（或者用下面的热重载）。

## 热重载

### UI 插件：有开关

「设置 → 插件」页顶部有一个 **Hot reload** 开关，默认开。

开着的时候：改代码 → `pnpm build` → 在设置页里让插件重新加载，**不用重启启动器**。

配合 watch 模式更顺：

```bash
pnpm watch    # vite build --watch，改一次自动构建一次
```

### 内容源：重新加载

内容源没有独立的开关。改完代码重新构建、重新复制文件后，在「设置 → 内容源」页里重新加载，或者重启启动器。

## 从商店安装

正式发布后，用户是**从商店装**的。本地也可以走这条路验证打包是否完整：

1. 把插件仓库推到 GitHub 并发布一个 Release（见[发布](/guide/publishing)）。
2. 在启动器的「设置 → 内容源 / 插件」里，从商店搜索并安装。

商店安装时启动器读的是 **zip**，所以这条路径能验证「我打包出来的 zip 是对的」。

## 调试：看日志

**启动器的日志窗口**是排查问题的第一站。两种插件的输出都带前缀：

```
[content-source:example] 已启动，入口在 example.com
[plugin:com.example.my-plugin] activated; page at /plugins/my-plugin
```

`api.log(...)` 可以传任意个参数，和 `console.log` 一样。

::: tip 日志是给别人看的
`api.log` 的输出会出现在用户报告的日志里。所以别打一堆调试噪音，尤其是别把 token、cookie 打出来——内容源经常要带这些头。
:::

## 报错从哪来

启动器把插件的错误分几类，看到时能直接定位：

| 错误文本 | 含义 | 去哪看 |
|---|---|---|
| `manifest.json is not valid: unknown variant \`resource_pack\`` | manifest 字段值不合法 | [manifest 字段](/source/manifest) |
| `Invalid content source id '...': use letters, digits...` | `id` 里有非法字符 | 上面「目录名必须等于 id」 |
| `Content source 'x' needs content-source API version 2, but this launcher supports up to 1` | `api_version` 高于启动器 | 把 `api_version` 改成 `1` |
| `Fetch to "https://foo.com" is not allowed` | 域名不在 `hosts` 里 | [网络与 hosts](/source/network) |
| `cannot use slots: the "slot:sidebar.top" permission has not been granted` | 权限没声明或没批准 | [权限](/plugin/manifest-permissions) |
| `The plugin does not export an activate() function.` | 入口没导出 `activate` | 检查 `entry` 指的文件 |
| `插件启动失败` + 一段堆栈 | `activate` 抛错了 | 堆栈会指到源码（有 sourcemap） |

**manifest 校验失败时，错误文本直接显示在设置页的插件卡片上。** 这是故意的——你不需要打开调试器就能看到哪个字段写错了。

## 常见坑

### 插件加载了但什么都不做

先确认 `capabilities` / `permissions` 声明对。

- 内容源：你实现了 `search` 但 `capabilities.search` 是 `false` → 启动器永远不调用它，不报错。
- UI 插件：你调了 `api.slots.add` 但 manifest 里没有 `slot:sidebar.top` → 抛错，插件的其余部分也停了。

### 改了代码没变化

- 构建了吗？（`pnpm build` / `pnpm watch` 在跑吗？）
- 复制到数据目录了吗？（内容源不会自动同步）
- 热重载了吗？（UI 插件要在设置页点一下）
- 改了 `manifest.json` 的话，通常需要重启——manifest 是在加载时读一次的。

### 域名访问被拒

`hosts` 是**精确匹配**的（支持 `*.example.com` 一级通配）。你要访问 `api.example.com`，只写 `example.com` **不够**。要把实际请求的每个域名都列上：

```json
"hosts": ["api.example.com", "cdn.example.com", "example.com"]
```

不知道请求了哪些域名？看日志里的拒绝信息，它会打印出被拒的完整 URL。

### 卸载后数据还在

卸载插件时可以选择是否一并删除它的数据。内容源的 `api.storage` 和 UI 插件的 `api.storage` 都是**按插件隔离**的，删插件不删数据，重装能恢复。

## 下一步

- 全部常见报错的排查清单：[FAQ](/faq)
- 发布给别人用：[打包与上架](/guide/publishing)
