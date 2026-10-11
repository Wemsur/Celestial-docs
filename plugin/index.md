# UI 插件

UI 插件（launcher plugin）给启动器**加界面和功能**——往侧边栏放卡片、注册自己的页面、注入样式、订阅应用事件，甚至下载并运行一个原生程序。

它跑在启动器的页面里，和启动器**共用同一个 Vue 实例**。

## 它和内容源的区别

| | 内容源 | UI 插件 |
|---|---|---|
| 做什么 | 提供内容（搜索、详情、下载地址） | 给启动器加界面和功能 |
| 界面 | **没有** | 有 |
| manifest 字段 | `capabilities` 对象 | `permissions` 数组 |
| 权限 | 只有 `hosts` 白名单 | 逐项声明 + 用户审批 |
| 装在哪 | `content-sources/<id>/` | `plugins/<id>/` |

还不确定写哪个？看[你该写哪一种](/guide/choosing)。

## 能力一览

UI 插件能做这些（每项对应一个权限）：

| 能力 | 权限 | 风险 |
|---|---|---|
| 注入 CSS | `style` | 低 |
| 读写自己的存储 | `storage` | 低 |
| 往插槽放 UI | `slot:<位置>` | 低 |
| 注册自己的页面 | `route` | 低 |
| 订阅应用事件 | `event:<类型>` | 低 |
| 调宿主接口 | `hostapi:<名称>` | **高** |
| 接管结构区域 | `region:<区域>` | **高** |
| 访问网络 | `network:<域名>` | **高** |
| 跑原生 sidecar | `sidecar` | **高** |
| 局域网联机广播 | `lan` | **高** |

低风险的装上即生效；高风险的等用户批准。

## 各页导航

**入门**（如果还没写过，从这里开始）：

- [15 分钟：第一个 UI 插件](/guide/getting-started-plugin)
- [项目结构与构建产物](/guide/anatomy)

**基础**：

- [manifest 与权限](/plugin/manifest-permissions) —— 权限模型、风险分级、优雅降级
- [Vue 与组件](/plugin/vue) —— 为什么共用同一个 Vue 实例

**扩展启动器**：

- [插槽](/plugin/slots) —— 往界面里放东西
- [自定义页面](/plugin/routes)
- [样式](/plugin/styling)
- [订阅事件](/plugin/events)
- [调用宿主接口](/plugin/hostapi)
- [接管结构区域](/plugin/regions)
- [设置与存储](/plugin/settings-storage)

**重型能力**：

- [原生 sidecar](/plugin/sidecar) —— 下载并运行一个原生程序
- [局域网联机](/plugin/lan)

## 最小骨架

```ts
import type { PluginHostApi } from '@celestial/plugin'

export async function activate(api: PluginHostApi): Promise<void> {
	api.styles.add('.my-card { padding: 12px; }')

	api.slots.add('sidebar.top', {
		id: 'card',
		component: MyCard,
	})

	api.log('activated')
}
```

`activate(api)` 是入口，启动器在应用渲染完之后调用一次。

---

准备好就开始：[manifest 与权限](/plugin/manifest-permissions)。
