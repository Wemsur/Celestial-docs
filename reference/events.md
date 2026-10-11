# 事件清单

`api.events.on(type, handler)` 可订阅的事件。讲解见[订阅事件](/plugin/events)。

| 事件 | 权限 | 什么时候触发 |
|---|---|---|
| `instance` | `event:instance` | 实例被创建、删除、修改 |
| `instance_groups_changed` | `event:instance_groups_changed` | 实例分组变化 |
| `instance_bulk_update_progress` | `event:instance_bulk_update_progress` | 批量更新实例的进度 |
| `process` | `event:process` | 启动器进程状态变化 |
| `install_job` | `event:install_job` | 安装任务的进度 |
| `library_changed` | `event:library_changed` | 多版本库变化 |
| `log` | `event:log` | 启动器产生一条日志 |

**全部是低风险权限**，声明即自动授予。

## 白名单

只有上表七个事件可订阅。其他事件（`friend`、`notification`、`loading`、`command`、`ads_consent_required`、`onboarding_checklist`）是启动器内部的，插件订阅会抛错：

```
Event "notification" is not available to plugins.
```

## 用法

```json
"permissions": ["event:instance"]
```

```ts
const unsubscribe = api.events.on('instance', (payload: unknown) => {
	// payload 是 unknown —— 自己判断形状，或者重新调宿主接口取
})
```

返回值是取消订阅函数。**一般不用手动调用**——插件卸载时启动器自动清理。

## 关于 payload

payload 的形状**没有强类型保证**（`unknown`）。它只是通知你「发生了什么事」，具体数据通常要重新调 `api.hostApi.call('instance.list')` 之类去取。

```ts
api.events.on('instance', async () => {
	try {
		const raw = await api.hostApi.call('instance.list')
		instances.value = Array.isArray(raw) ? raw : []
	} catch {
		instances.value = null
	}
})
```

---

下一篇：[宿主接口清单](/reference/hostapi)。
