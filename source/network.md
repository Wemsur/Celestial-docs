# 网络与 hosts 白名单

内容源**不能自己发网络请求**。这一页讲为什么，以及唯一的出口 `api.net.fetch` 怎么用。

## 为什么不能直接 fetch

插件跑在启动器的 webview 里。webview 有一个 CSP（内容安全策略），它限制了插件能连的域名——而且**插件不能往这个列表里加东西**。

所以插件里写 `fetch('https://example.com/...')` 会失败。

启动器提供的替代品是：

```ts
await api.net.fetch(url, options)
```

**实际的请求由启动器的 Rust 侧发出**，不经过 webview 的 CSP。

## 白名单是硬校验

`api.net.fetch` 只能访问 manifest 里 `hosts` 声明过的域名：

```json
"hosts": ["example.com", "*.example.com", "cdn.example.com:8443"]
```

请求其他域名会被后端拒绝：

```
Content source 'example' did not declare access to 'api.other.com'
```

这是硬校验，绕不过去——它在 Rust 里做的，插件改不了。

### 匹配规则

| 声明 | 匹配 | 不匹配 |
|---|---|---|
| `example.com` | `example.com` | `api.example.com` |
| `*.example.com` | `api.example.com` | `example.com`、`a.b.example.com`、`example.com.evil.com` |
| `example.com:8443` | 只有 8443 端口 | 其他端口 |

大小写不敏感。`*.example.com` **只匹配一级子域**——这是故意的，避免 `*.example.com` 意外覆盖到 `a.b.example.com`。

::: warning 通配符别写太宽
`"hosts": ["*"]` 或者 `"hosts": ["*.com"]` 会把「这个源能访问哪里」这个问题变得无法回答。用户装你的源时，看到的承诺是「它只会访问 example.com」——写宽了，这个承诺就没了。

写**实际请求的每一个域名**。官方 GitHub 源列了四个，因为下载会重定向：

```json
"hosts": [
	"api.github.com",
	"github.com",
	"objects.githubusercontent.com",
	"release-assets.githubusercontent.com"
]
```
:::

## 用法

```ts
const response = await api.net.fetch('https://example.com/api/items?page=1', {
	method: 'GET', // 默认 GET
	headers: {
		accept: 'application/json',
		'user-agent': 'Mozilla/5.0 ...', // 站点要求像浏览器时
	},
	body: '{"a":1}', // 字符串，POST/PUT/PATCH 时用
})
```

### 返回值

```ts
response.status // 200
response.ok // status 在 200-299
response.headers // { 'content-type': 'application/json', ... }
response.body // 响应体字符串（不是 stream）
response.final_url // 跟随重定向后的最终地址
```

::: tip `body` 是字符串，不是 JSON
`api.net.fetch` 不解析 JSON，也不解压——它给你一个字符串。自己 `JSON.parse(response.body)`。

`response.body` 也不是 stream，整个响应体已经读完了。所以别用它下大文件（见下面的上限）。
:::

### `final_url` 有什么用

跟随重定向后的地址。有些站点需要你先请求一次拿到真实地址，再拿它做别的事。比如 GitHub 的 Release 下载会 302 到 `objects.githubusercontent.com`——那个域名也得写进 `hosts`。

## 限制

| 项目 | 上限 |
|---|---|
| 响应体大小 | 16 MiB |
| 请求体大小 | 4 MiB |
| 支持的方法 | `GET`、`POST`、`PUT`、`PATCH`、`DELETE`、`HEAD` |

超过响应上限会报错：

```
Response is larger than 16 MiB
```

::: danger 不要用 api.net.fetch 下载模组文件
16 MiB 对 JSON API 绰绰有余，但模组文件经常更大。**下载文件不走这里**——你只需要在 `resolveDownload()` 里返回一个 URL，启动器自己去下（它有流式下载和进度条）。

`api.net.fetch` 是用来**问问题**的（搜什么、这个项目长什么样），不是用来搬文件的。
:::

## 请求头

大部分头都可以带。内容站经常需要看起来像浏览器，API 源需要 token，这些都被允许：

| 头 | 允许 |
|---|---|
| `cookie` | ✅ |
| `referer` | ✅ |
| `user-agent` | ✅ |
| `authorization` | ✅ |
| 其他常规头（`accept`、`content-type`、自定义 `x-*`） | ✅ |
| `host` | ❌ |
| `content-length` | ❌ |
| `connection` | ❌ |
| `transfer-encoding` | ❌ |
| `proxy-*` | ❌ |

被禁的是**决定连接本身的头**——让插件伪造 `Host` 会变成一个请求走私的立足点。被禁的头会被**静默忽略**，请求照发（不会因此报错）。

## 实践建议

### 别写重试风暴

`api.net.fetch` 由启动器发出。站点被封或限流时，**失败就让它失败**，把原因 `api.log` 出来比反复重试更有用：

```ts
// ✅ 失败就报错，把状态码带上
const response = await api.net.fetch(url)
if (!response.ok) {
	throw new Error(`示例站返回 ${response.status} ${response.statusText ?? ''}`)
}
```

```ts
// ❌ 循环重试会把用户的网络和站点一起拖垮
for (let i = 0; i < 5; i++) {
	try {
		return await api.net.fetch(url)
	} catch {}
}
```

### 用 headers 传认证

需要 token 的 API：

```ts
const token = await api.settings.get('apiKey')
const response = await api.net.fetch('https://api.example.com/search', {
	headers: {
		accept: 'application/json',
		...(token ? { authorization: `Bearer ${token}` } : {}),
	},
})
```

需要 cookie 的站点：

```ts
const cookie = await api.storage.get('cookie')
const response = await api.net.fetch('https://example.com/api/list', {
	headers: {
		...(cookie ? { cookie } : {}),
		referer: 'https://example.com/',
		'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
	},
})
```

### 编码参数

URL 里的查询参数一定要 `encodeURIComponent`：

```ts
const url = `https://example.com/search?q=${encodeURIComponent(query)}&page=${page}`
```

搜索词里带 `&`、`#`、空格、中文时，不编码会得到错误的结果或直接失败。

### 整理成一个小 helper

几乎所有内容源都会先写一个这样的函数，把「拼 URL + 带头 + 检查状态 + 解析 JSON」收拢到一处：

```ts
async function get<T>(path: string): Promise<T> {
	const response = await api.net.fetch(`https://example.com/api${path}`, {
		headers: { accept: 'application/json' },
	})
	if (!response.ok) {
		throw new Error(`示例站返回 ${response.status}：${path}`)
	}
	return JSON.parse(response.body) as T
}
```

后面的页面都会用这个形状。

---

接下来：[七种内容类型](/source/content-types)。
