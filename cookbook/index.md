# 配方

指南讲的是「怎么写」，参考手册是「查什么」。**配方是「别人怎么写的」**——逐个拆解官方插件，看真实的代码是怎么把概念拼起来的。

官方的六个插件覆盖了从最简单到最复杂的全部情况。建议按下面的顺序读，每一篇都比上一篇多一点东西。

## 内容源

| 配方 | 复杂度 | 能学到 |
|---|---|---|
| [最小内容源](/cookbook/minimal-source) | ⭐ | 一个内容源的完整骨架 |
| [拆解：像素茶艺地图源](/cookbook/pixelmap-source) | ⭐⭐ | 简单 JSON API、BBCode 方言、世界类型 |
| [拆解：MC百科源](/cookbook/mcmod-source) | ⭐⭐⭐ | 没有下载的纯浏览源、HTML 解析 |
| [拆解：GitHub Releases 源](/cookbook/github-source) | ⭐⭐⭐⭐ | 手动条目、README 处理、多文件版本、更新检查 |
| [拆解：CurseForge 源](/cookbook/curseforge-source) | ⭐⭐⭐⭐⭐ | 镜像、批量接口、中文标签、整合包 |

## UI 插件

| 配方 | 复杂度 | 能学到 |
|---|---|---|
| [拆解：一言插件](/cookbook/hitokoto-plugin) | ⭐⭐ | 最小的 UI 插件、定时器、网络请求 |
| [拆解：陶瓦联机插件](/cookbook/terracotta-plugin) | ⭐⭐⭐⭐⭐ | sidecar + LAN 的完整实战 |

## 怎么读这些拆解

每篇的写法是：

1. **这个插件解决什么问题** —— 它的定位和取舍。
2. **manifest 逐字段** —— 为什么这么声明。
3. **关键代码逐段** —— 不只是贴代码，而是讲**为什么这么写**。
4. **踩过的坑** —— 那些不写下来你一定会踩的东西。

源码都在 GitHub 上，可以对着看：

- [celestial-content-pixelmap](https://github.com/Wemsur/celestial-content-pixelmap)
- [celestial-content-mcmod](https://github.com/Wemsur/celestial-content-mcmod)
- [celestial-content-github](https://github.com/Wemsur/celestial-content-github)
- [celestial-content-curseforge](https://github.com/Wemsur/celestial-content-curseforge)
- [celestial-hitokoto](https://github.com/Wemsur/celestial-hitokoto)
- [celestial-terracotta](https://github.com/Wemsur/celestial-terracotta)

---

从[最小内容源](/cookbook/minimal-source)开始。
