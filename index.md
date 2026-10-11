---
layout: home

hero:
  name: Celestial Launcher
  text: 插件开发文档
  tagline: 给启动器加一个新的下载源，或者给它加一个新的界面。从零写一个能用的插件，到发布上架。
  image:
    src: /celestial.svg
    alt: Celestial Launcher
  actions:
    - theme: brand
      text: 我该写哪一种？
      link: /guide/choosing
    - theme: alt
      text: 直接开始（内容源）
      link: /guide/getting-started-source
    - theme: alt
      text: 直接开始（UI 插件）
      link: /guide/getting-started-plugin

features:
  - icon: 🔌
    title: 内容源：给启动器加一个下载源
    details: 把任何站点、API 或仓库接进来，让它的内容出现在启动器的浏览页里，并且能被搜索、查看、安装。它不提供任何界面。
    link: /source/
    linkText: 写一个内容源
  - icon: 🧩
    title: UI 插件：给启动器加界面和功能
    details: 往侧边栏放卡片、注册自己的页面、注入样式、订阅应用事件，甚至下载并运行一个原生程序。能力由权限系统限定。
    link: /plugin/
    linkText: 写一个 UI 插件
  - icon: 📦
    title: 发布到商店
    details: 打一个 tag，GitHub Actions 自动构建并发布 Release，用户那边自动看到更新。整个流程不需要人工干预。
    link: /guide/publishing
    linkText: 发布流程
  - icon: 🧭
    title: 照着现有插件抄
    details: 官方已经写了六个插件，覆盖从「最小可用的地图站」到「带镜像和整合包的 CurseForge」。每个都逐行拆解。
    link: /cookbook/
    linkText: 看实例拆解
---

## 这份文档写给谁

写给**稍微懂点编程、但没有写过 Celestial 插件**的人。

它不教 TypeScript、不教 Vue、不教怎么用终端——那些是前提。它只讲**启动器特有的东西**：插件能碰什么、不能碰什么、启动器替你做掉了哪些脏活、以及为什么这么设计。

每讲一个概念，顺序都是：

1. **启动器为什么这么设计** —— 理解了原因，你才知道边界在哪。
2. **你要写什么** —— 可以直接复制的代码。
3. **不这么做会怎样** —— 真实的报错长什么样，以及怎么从报错找回这里。

## 两类插件，先选一个

启动器有**两套互不相通**的插件系统。它们的 manifest 格式不同、目录不同、能做的事也不同：

| | 内容源 | UI 插件 |
|---|---|---|
| 一句话 | 给启动器加一个下载源 | 给启动器加界面和功能 |
| 有界面吗 | **没有** | 有 |
| 装在哪 | `content-sources/` | `plugins/` |
| 索引文件 | `content-sources.json` | `plugins.json` |
| 提交表单 | 「提交内容源」 | 「提交插件」 |
| 想写哪个 | [开始](/guide/getting-started-source) | [开始](/guide/getting-started-plugin) |

还不确定？看[你该写哪一种](/guide/choosing)，它用几个问题帮你判断。
