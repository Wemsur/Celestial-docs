# 内容源

内容源（content source）是启动器的一类插件：它给启动器**提供下载源**，本身不提供任何界面。

## 它做什么

一个内容源回答三个问题：

1. **有什么** —— 搜索、浏览
2. **长什么样** —— 详情、版本列表
3. **文件从哪下** —— 给一个地址

## 它不做什么

这条是硬约束：

> **内容源只能提议内容，不能放置内容。**

| 启动器负责的 | 内容源负责的 |
|---|---|
| 下载文件 | 给出文件的 URL |
| 校验 hash | 可选地提供 hash |
| 决定装到哪个目录 | 声明内容的**类型** |
| 处理覆盖、去重、重命名 | —— |
| 界面、排序、筛选 | 提供原始数据和筛选选项 |

所以内容源**不需要关心 UI，也不需要碰文件系统**。它只有两样工具：`api.net.fetch` 和 `api.storage`。

## 能力清单

内容源有六项能力，在 manifest 的 `capabilities` 里声明。你只实现声明为 `true` 的：

| 能力 | 方法 | 一句话 |
|---|---|---|
| `search` | `search(request)` | 按关键词搜索 |
| `browse` | `browse(request)` | 不带关键词浏览 |
| `detail` | `detail(id)` | 项目详情页 |
| `versions` | `versions(id, request)` | 版本列表 |
| `resolve_download` | `resolveDownload(id, versionId?, fileId?)` | 给出下载地址 |
| `update_check` | `checkUpdate(items)` | 检查更新 |

声明 `false` 只是**降级**，不是错误。一个没有 `resolve_download` 的源照样能浏览和看详情，只是安装按钮不可用。

## 各页导航

**入门**（如果你还没写过内容源，从这里开始）：

- [15 分钟：第一个内容源](/guide/getting-started-source)
- [项目结构与构建产物](/guide/anatomy)

**manifest 与基础设施**：

- [manifest.json 字段](/source/manifest) —— 每个字段的含义与校验规则
- [网络与 hosts 白名单](/source/network) —— 唯一的网络出口，允许哪些头
- [七种内容类型](/source/content-types) —— 每种类型的安装行为

**实现各项能力**：

- [搜索与浏览](/source/search-browse)
- [详情页](/source/detail)
- [版本列表](/source/versions)
- [下载地址](/source/resolve-download)
- [侧边栏筛选](/source/filters)
- [整合包](/source/modpacks)
- [更新检查](/source/update-check)

**进阶**：

- [多语言](/source/i18n)
- [设置与存储](/source/settings-storage)
- [手动条目](/source/manual-entry) —— 没有可浏览目录的源

## 最小骨架

一个内容源的全部代码就是这个形状：

```ts
import type { ContentSourceApi } from '@celestial/content-source'

export async function activate(api: ContentSourceApi) {
	api.register({
		async search(request) { /* ... */ },
		async browse(request) { /* ... */ },
		async detail(id, contentType) { /* ... */ },
		async versions(id, request) { /* ... */ },
		async resolveDownload(id, versionId, fileId) { /* ... */ },
		async checkUpdate(items) { /* ... */ },
		async filters(contentType) { /* ... */ },
		async resolveModpack(manifestJson) { /* ... */ },
	})
}
```

`api.register` **只调用一次**。传进去的对象里放你声明为 `true` 的方法（`filters` 和 `resolveModpack` 不需要在 `capabilities` 里声明，按需实现）。

---

准备好就开始：[manifest.json 字段](/source/manifest)。
