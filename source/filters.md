# 侧边栏筛选

`filters` 让你在浏览页的侧边栏里加自己的筛选条件——比如站点的分类、元素、状态。

```ts
async filters(contentType: ContentType): Promise<SourceFilterGroup[]>
```

这个方法**不需要在 `capabilities` 里声明**，实现了就会用。

## 返回什么

```ts
[
	{
		id: 'category',
		header: 'categories',
		options: [
			{ id: '4780', label: '数据包' },
			{ id: '12', label: '科技' },
		],
	},
]
```

| 字段 | 说明 |
|---|---|
| `id` | 组的 id，**唯一**。回传时作为 `request.filters` 的键 |
| `header` | 组的标题。命中内置名字时会合并（见下） |
| `options[].id` | 选项 id，**必须稳定** |
| `options[].label` | 显示名，可以翻译 |

## 与内置分组合并

启动器侧边栏有几个**内置分组**：

- `categories`（分类）
- `features`（特性）
- `performance impact`（性能影响）

你的 `header` 命中其中一个时，你的选项会**并进那一个分组**，而不是多出一个同名分组：

```ts
// header 是 'categories' → 和 Modrinth 的分类合并成一个「分类」栏，选项去重
{ id: 'category', header: 'categories', options: [...] }

// header 是别的 → 单独成一组
{ id: 'elements', header: '元素', options: [...] }
```

::: tip 这正是要的效果
「分类」在侧边栏只出现**一次**，里面同时有 Modrinth 的分类和你的分类。如果每个源都出一个「分类」栏，用户会看到好几个一模一样的标题。

官方的 CurseForge 源就把它的分类用 `header: 'categories'` 声明，于是和 Modrinth 的合并在了一起。
:::

## 回传给 `search` / `browse`

用户勾选的结果通过 `request.filters` 回来：

```ts
// 用户在 category 组里勾了 4780 和 12
request.filters // { category: ['4780', '12'] }
```

键是你在 `filters()` 里给的**组 `id`**，值是勾选的**选项 `id`** 数组。

```ts
async search(request: ContentQuery): Promise<ContentPage> {
	const params = new URLSearchParams({ q: request.query ?? '' })

	const categoryIds = request.filters?.category
	if (Array.isArray(categoryIds) && categoryIds.length > 0) {
		params.set('categories', categoryIds.join(','))
	}

	// ...
}
```

## 两条铁律

::: danger 一、选项 id 必须稳定
`options[].id` 是**回传给你做筛选的**。它必须是一个不变的值——**用站点自己的数字 id 最省事**。

```ts
// ✅ 用站点的 id
{ id: '4780', label: '数据包' }

// ❌ 用显示名/id 混用，翻译一改筛选就失灵
{ id: '数据包', label: '数据包' }
```
:::

::: danger 二、只有 label 该翻译
`label` 是给人看的，可以随 `api.i18n.locale` 翻译。**`id` 绝对不能翻**——翻了之后用户勾选回传的 id 和你期望的对不上，筛选直接失效。

```ts
// ✅ 翻译 label，保留 id
const zh = api.i18n.locale.toLowerCase().startsWith('zh')
options.map((option) => ({
	id: option.id,
	label: zh ? CATEGORY_ZH[option.id] ?? option.label : option.label,
}))
```

详见[多语言](/source/i18n)。
:::

## 分组按内容类型给

`filters` 会收到 `contentType`——因为不同内容类型的筛选条件不同：

```ts
async filters(contentType: ContentType): Promise<SourceFilterGroup[]> {
	if (contentType === 'mod') {
		return [
			{ id: 'category', header: 'categories', options: modCategories },
			{ id: 'loader', header: 'loaders', options: loaders },
		]
	}
	if (contentType === 'modpack') {
		return [{ id: 'category', header: 'categories', options: packCategories }]
	}
	return []
}
```

返回空数组表示「这个类型没有额外筛选」。

## 完整例子

```ts
api.register({
	async filters(contentType: ContentType): Promise<SourceFilterGroup[]> {
		if (contentType !== 'mod') return []

		const categories = await get<any>('/categories')

		return [
			{
				id: 'category',
				header: 'categories',
				options: categories.map((category: any) => ({
					id: String(category.id), // 稳定
					label: category.name, // 可翻译
				})),
			},
		]
	},

	async search(request: ContentQuery): Promise<ContentPage> {
		const params = new URLSearchParams({
			q: request.query ?? '',
			page: String(request.page),
			limit: String(request.limit),
		})

		const selected = request.filters?.category
		if (Array.isArray(selected) && selected.length > 0) {
			params.set('category', selected.join(','))
		}

		const page = await get<any>(`/search?${params}`)
		return { items: page.hits.map(toCard), total: page.total }
	},
})
```

## 筛选是「或」还是「与」

启动器不做判断——它只把勾选的 id 数组原样给你。**同一个组内多个选项之间是什么关系（或 / 与），由你的 API 决定**，你只要把 id 传给它就行。

## 常见错误

| 现象 | 原因 |
|---|---|
| 侧边栏出现两个「分类」 | `header` 没写 `'categories'`（大小写也要一致） |
| 勾了没反应 | 没读 `request.filters`，或者键名和组 `id` 对不上 |
| 换语言后筛选失灵 | 把 `id` 也翻译了 |
| 选项重复出现 | 和内置分组同名但没合并——检查 `header` 拼写 |

---

接下来：[整合包](/source/modpacks)。
