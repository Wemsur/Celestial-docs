# 权限总表

UI 插件的权限。讲解见 [manifest 与权限](/plugin/manifest-permissions)。

## 全部权限

| 权限 | scope | 风险 | 能力 |
|---|---|---|---|
| `storage` | 无 | 低 | 读写自己的数据目录 |
| `style` | 无 | 低 | 注入 CSS |
| `slot:<位置>` | 插槽 id | 低 | 往插槽放 UI |
| `route` | 无 | 低 | 注册自定义页面 |
| `event:<类型>` | 事件类型 | 低 | 订阅应用事件 |
| `network:<域名>` | 域名 | **高** | 访问指定域名 |
| `region:<区域>` | 区域 id | **高** | 接管结构区域 |
| `hostapi:<名称>` | 接口名 | **高** | 调用宿主接口 |
| `sidecar` | 无 | **高** | 下载并运行原生程序 |
| `lan` | 无 | **高** | 局域网联机广播 |

## scope 的有无是强校验

::: danger 两边的错误都会让 manifest 被拒绝
**不带 scope 的 kind**：`storage`、`style`、`route`、`sidecar`、`lan`

```json
"permissions": ["style"] // ✅
"permissions": ["style:global"] // ❌ 'style' does not take a scope
```

**带 scope 的 kind**：`slot`、`event`、`network`、`region`、`hostapi`

```json
"permissions": ["slot:sidebar.top"] // ✅
"permissions": ["slot"] // ❌ 'slot' needs a scope
```
:::

## scope 的取值

### `slot:<位置>`

见[插槽清单](/reference/slots)。

```
topbar.left, topbar.center, topbar.right,
navbar.bottom,
sidebar.top, sidebar.after-jumpback, sidebar.after-account, sidebar.bottom,
home.top, home.middle, home.bottom
```

### `event:<类型>`

见[事件清单](/reference/events)。

```
instance, instance_groups_changed, instance_bulk_update_progress,
process, install_job, library_changed, log
```

### `network:<域名>`

域名，可带 `*.` 通配和端口：

```
example.com
*.example.com
127.0.0.1:8080
```

只允许字母数字、`.`、`-`、`_`。不能含空白字符。

### `region:<区域>`

```
navbar, topbar, sidebar
```

### `hostapi:<名称>`

见[宿主接口清单](/reference/hostapi)。

```
instance.list, instance.get, library.list, auth.default_username
```

## 低风险 vs 高风险

| | 低风险 | 高风险 |
|---|---|---|
| 授予方式 | 装上即自动授予 | 用户在设置页**手动批准** |
| 未批准时 | —— | 调用抛错 |
| 最坏情况 | 启动器变丑 | 读到用户数据 / 改动启动器结构 / 跑原生代码 |

## 未批准时的错误

```
Plugin "com.example.x" cannot use slots: the "slot:sidebar.top" permission has not been granted.
Plugin "com.example.x" cannot listen to "instance": the "event:instance" permission has not been granted.
This plugin cannot access region "topbar": the "region:topbar" permission has not been granted.
```

所以高风险能力要包 `try` 并优雅降级。

---

下一篇：[插槽清单](/reference/slots)。
