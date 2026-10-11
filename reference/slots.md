# 插槽清单

`api.slots.add(slot, ...)` 可用的插槽 id。讲解见[插槽](/plugin/slots)。

| 插槽 id | 权限 | 位置 |
|---|---|---|
| `topbar.left` | `slot:topbar.left` | 顶栏左侧 |
| `topbar.center` | `slot:topbar.center` | 顶栏中间 |
| `topbar.right` | `slot:topbar.right` | 顶栏右侧 |
| `navbar.bottom` | `slot:navbar.bottom` | 左侧导航栏底部 |
| `sidebar.top` | `slot:sidebar.top` | 侧边栏顶部 |
| `sidebar.after-jumpback` | `slot:sidebar.after-jumpback` | 侧边栏「返回」之后 |
| `sidebar.after-account` | `slot:sidebar.after-account` | 侧边栏账号区之后 |
| `sidebar.bottom` | `slot:sidebar.bottom` | 侧边栏底部 |
| `home.top` | `slot:home.top` | 主页顶部 |
| `home.middle` | `slot:home.middle` | 主页中部 |
| `home.bottom` | `slot:home.bottom` | 主页底部 |

## 用法

```json
"permissions": ["slot:sidebar.top"]
```

```ts
api.slots.add('sidebar.top', {
	id: 'card',
	component: MyCard,
	props: { onOpen: () => api.router.push('/plugins/my-plugin') },
})
```

## `SlotDefinition`

```ts
{
	id: string // 必填，同插槽内唯一
	component?: Component
	props?: Record<string, unknown>
	render?: () => Node | null | void
}
```

`component` 和 `render` 二选一。优先用 `component`。

## 结构区域（另一种）

`region:<区域>` 是**高风险**能力，拿到的是整个容器，可以重排。只有三个：

| 区域 | 权限 |
|---|---|
| `navbar` | `region:navbar` |
| `topbar` | `region:topbar` |
| `sidebar` | `region:sidebar` |

见[接管结构区域](/plugin/regions)。

---

下一篇：[事件清单](/reference/events)。
