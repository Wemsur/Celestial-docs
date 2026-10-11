# 宿主接口清单

`api.hostApi.call(name, ...args)` 可调用的宿主接口。讲解见[调用宿主接口](/plugin/hostapi)。

| 名称 | 权限 | 参数 | 返回 |
|---|---|---|---|
| `instance.list` | `hostapi:instance.list` | `libraryPath?: string` | 实例数组 |
| `instance.get` | `hostapi:instance.get` | `instanceId: string` | 单个实例 |
| `library.list` | `hostapi:library.list` | 无 | 多版本库信息 |
| `auth.default_username` | `hostapi:auth.default_username` | 无 | 用户名或 `null` |

**全部是高风险权限**，需要用户手动批准。

## 特性

- **只读**：这四个接口都不改变启动器状态。
- **白名单**：调用其他名字抛 `Unknown host API "xxx".`
- **返回 `unknown`**：没有强类型，自己判断形状。

## 用法

```json
"permissions": ["hostapi:instance.list"]
```

```ts
try {
	const raw = await api.hostApi.call('instance.list')
	const instances = Array.isArray(raw) ? raw : []
} catch {
	// 未授权，降级
}
```

每一项要**单独声明**——声明了 `hostapi:instance.list` 不代表能调 `instance.get`。

---

参考手册到此结束。去[配方](/cookbook/)看真实插件的写法，或者查 [FAQ](/faq)。
