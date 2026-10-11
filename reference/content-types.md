# 内容类型表

启动器的**封闭取值**。讲解见[七种内容类型](/source/content-types)。

## 取值

| 取值 | 中文 | 安装位置 | 需选实例 |
|---|---|---|---|
| `mod` | 模组 | `<实例>/mods/` | 是 |
| `modpack` | 整合包 | 新建实例 | 否（选库） |
| `resourcepack` | 资源包 | `<实例>/resourcepacks/` | 是 |
| `shader` | 光影 | `<实例>/shaderpacks/` | 是 |
| `datapack` | 数据包 | `<实例>/datapacks/` | 是 |
| `world` | 世界（地图） | `<实例>/saves/`，**永不覆盖** | 是 |
| `skin` | 皮肤 | 启动器数据目录的 `skins/` | **否** |

::: danger 拼写
`resourcepack` 和 `datapack` 是**连写**的。写成 `resource_pack` / `data_pack` 会被拒绝：

```
manifest.json is not valid: unknown variant `resource_pack`, expected one of `mod`, `modpack`, `resourcepack`, `shader`, `datapack`, `world`, `skin`
```
:::

## 加载器拼写

`versions()` 和 `ContentCard` 里的 `loaders` 用启动器的拼写：

| 值 | 说明 |
|---|---|
| `vanilla` | 无加载器 |
| `forge` | Forge |
| `fabric` | Fabric |
| `neoforge` | NeoForge |
| `quilt` | Quilt |

## 排序取值

```ts
type ContentSort = 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated'
```

| 值 | 排序依据 |
|---|---|
| `relevance` | 搜索词为空时启动器按 `downloads` 重排；有搜索词时保留你的顺序 |
| `downloads` | `downloads × 源倍率`，降序 |
| `follows` | `follows`，降序 |
| `newest` | `publishedAt`，降序 |
| `updated` | `updatedAt`，降序 |

## 版本通道

`ContentVersion.channel`：

| 值 | 说明 |
|---|---|
| `release` | 正式版 |
| `beta` | 测试版 |
| `alpha` | 内测版 |

## 源徽章

浏览页里每个内容项带一个源徽章，按顺序降级：

1. manifest 的 `icon` 图片
2. Modrinth logo（仅 Modrinth 源）
3. `name` 首字母，画在 `color` 色的圆角方块上

## 筛选分组的内置 header

`filters()` 返回的 `header` 命中下面之一时，选项**并进**该内置分组：

| header | 中文 |
|---|---|
| `categories` | 分类 |
| `features` | 特性 |
| `performance impact` | 性能影响 |

其他 header 单独成组。

---

下一篇：[PluginHostApi 全量](/reference/plugin-api)。
