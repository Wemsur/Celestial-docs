# UI 插件参考：PluginHostApi

`activate(api)` 拿到的 `api` 对象。权威类型在启动器仓库的 `plugin-sdk/template/types/celestial-plugin.d.ts`。

```ts
export async function activate(api: PluginHostApi): Promise<void> {
	// ...
}
```

## 成员一览

| 成员 | 权限 | 说明 |
|---|---|---|
| `api.plugin` | 无 | 插件身份 |
| `api.vue` | 无 | 启动器的 Vue 运行时 |
| `api.styles.add` | `style` | 注入 CSS |
| `api.slots.add` | `slot:<位置>` | 往插槽放 UI |
| `api.routes.add` | `route` | 注册页面 |
| `api.router` | 无 | 导航 |
| `api.storage` | `storage` | 读写自己的存储 |
| `api.settings` | 无 | 读设置值；`render` 加自定义 UI |
| `api.events.on` | `event:<类型>` | 订阅事件 |
| `api.hostApi.call` | `hostapi:<名称>` | 调宿主接口 |
| `api.regions.get` | `region:<区域>` | 拿结构区域容器 |
| `api.net.fetch` | `network:<域名>` | 网络请求 |
| `api.sidecar` | `sidecar` | 原生 sidecar |
| `api.lan` | `lan` | 局域网广播 |
| `api.platform` | 无 | 宿主平台 |
| `api.ui` | 无 | 启动器的 UI 组件 |
| `api.log` | 无 | 日志 |

## `api.plugin`

```ts
api.plugin.id // string
api.plugin.name // string
api.plugin.version // string
```

## `api.vue`

启动器的 Vue 运行时子集。见 [Vue 与组件](/plugin/vue)。

```ts
{
	h, ref, reactive, computed, watch, shallowRef, defineComponent,
	Teleport, onMounted, onUnmounted
}
```

## `api.styles.add(css)`

注入 CSS。见[样式](/plugin/styling)。

## `api.slots.add(slot, definition)`

见[插槽](/plugin/slots)。

```ts
{
	id: string // 同插槽内唯一
	component?: Component
	props?: Record<string, unknown>
	render?: () => Node | null | void
}
```

插槽 id 见[插槽清单](/reference/slots)。

## `api.routes.add(route)`

见[自定义页面](/plugin/routes)。

```ts
{
	path: string // 必须以 '/' 开头
	name?: string
	component: Component
	sidebar?: boolean // 是否在左侧导航栏显示入口，默认 true
	title?: string // 导航栏图标下方的文字
	icon?: string // 导航栏图标，内联 SVG 字符串
}
```

## `api.router`

```ts
api.router.push(to: string): void
api.router.replace(to: string): void
api.router.current(): string // 快照
api.router.currentPath // ComputedRef<string>，响应式
```

**不需要权限。**

## `api.storage`

```ts
api.storage.get(key): Promise<string | null>
api.storage.set(key, value): Promise<void>
api.storage.remove(key): Promise<void>
api.storage.keys(): Promise<string[]>
```

## `api.settings`

```ts
api.settings.get(key): Promise<string | null>
api.settings.all(): Promise<Record<string, string>>
api.settings.render(definition: SettingsDefinition): void
```

```ts
interface SettingsDefinition {
	id: string
	component?: Component
	props?: Record<string, unknown>
	render?: () => Node | null | void
}
```

## `api.events.on(type, handler)`

返回取消订阅函数。事件类型见[事件清单](/reference/events)。

```ts
const unsubscribe = api.events.on('instance', (payload: unknown) => {})
```

## `api.hostApi.call(name, ...args)`

见[调用宿主接口](/plugin/hostapi)。接口名见[宿主接口清单](/reference/hostapi)。

```ts
api.hostApi.call(name: string, ...args: unknown[]): Promise<unknown>
```

## `api.regions.get(name)`

见[接管结构区域](/plugin/regions)。

```ts
api.regions.get(name: 'navbar' | 'topbar' | 'sidebar'): HTMLElement
```

## `api.net.fetch(url, options?)`

```ts
{
	method?: string
	headers?: Record<string, string>
	body?: string
}
// →
{
	status: number
	ok: boolean
	headers: Record<string, string>
	body: string
}
```

## `api.sidecar`

见[原生 sidecar](/plugin/sidecar)。

```ts
api.sidecar.ensure(key, url, options?): Promise<void>
api.sidecar.start(key, args, portFile?): Promise<{ handle: number; port: number | null }>
api.sidecar.request(handle, init): Promise<{ status: number; ok: boolean; body: string }>
api.sidecar.stop(handle): Promise<void>
api.sidecar.status(key): Promise<{ installed: boolean; version: string | null }>
```

### `ensure` 的 `options`

```ts
{
	sha512?: string
	sha512Url?: string
	archive?: string // 'tar.gz' | 'zip' | 'none'
	version?: string
}
```

### `request` 的 `init`

```ts
{
	path: string // 路径 + 查询串，原样发送
	method?: string
	headers?: Record<string, string>
	body?: string
}
```

## `api.lan`

见[局域网联机](/plugin/lan)。

```ts
api.lan.announce(motd: string, port: number): Promise<{ handle: number }>
api.lan.stop(handle: number): Promise<void>
```

## `api.platform`

```ts
api.platform.os // 'windows' | 'macos' | 'linux' | ...
api.platform.arch // 'x86_64' | 'aarch64' | ...
```

**不需要权限。**

## `api.ui`

启动器的几个 UI 组件。**不需要权限。**

```ts
const { Button, Input, Toggle, DropdownSelect } = api.ui
```

只有不需要启动器全局注入上下文的组件才可用。

## `api.log(...args)`

自动加 `[plugin:<id>]` 前缀。

---

下一篇：[UI 插件 manifest 全字段](/reference/manifest-plugin)。
