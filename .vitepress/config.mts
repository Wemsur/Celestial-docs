import { defineConfig } from 'vitepress'

// 站点部署在 docs.celestial.wemsur.top（Vercel），域名根，所以 base 用默认的 '/'。
// 若改为子路径部署（如 celestial.wemsur.top/docs/），把 base 改成 '/docs/'。
export default defineConfig({
	lang: 'zh-CN',
	title: 'Celestial Launcher',
	titleTemplate: ':title · 插件开发文档',
	description: 'Celestial Launcher 插件与内容源的开发文档：从零写一个能装的插件，到发布上架。',

	// 正文里写错链接是开发文档最常见的问题，构建时直接报错而不是留一个死链。
	ignoreDeadLinks: false,

	head: [
		['link', { rel: 'icon', type: 'image/svg+xml', href: '/celestial.svg' }],
		['meta', { name: 'theme-color', content: '#1a1a1a' }],
	],

	markdown: {
		theme: { light: 'github-light', dark: 'github-dark' },
		// ```mermaid 代码块存进一个 data-graph 属性，交给主题在客户端渲染。
		//
		// 为什么要放属性而不是元素文本：VitePress 把渲染出的 HTML 当 Vue 模板
		// 再编译一次，Vue 会折叠文本节点里的连续空白——图表里的换行会被压成一个
		// 空格，mermaid 于是把所有语句看成一行，报 "Expecting 'NEWLINE'"。属性值
		// 不受这个折叠影响，所以源码放属性里最稳。
		//
		// 没有用 vitepress-plugin-mermaid：它靠模块路径里含正斜杠的字符串判断该给
		// 谁注册组件，Windows 上模块路径是反斜杠，判断永远不成立，图会渲染成空 div。
		config: (md) => {
			const fence = md.renderer.rules.fence
			if (!fence) return
			md.renderer.rules.fence = (tokens, index, options, env, self) => {
				const token = tokens[index]
				if (token.info.trim() === 'mermaid') {
					const graph = encodeURIComponent(token.content.trim())
					return `<div class="mermaid" data-graph="${graph}"></div>\n`
				}
				return fence(tokens, index, options, env, self)
			}
		},
	},

	themeConfig: {
		logo: '/celestial.svg',
		siteTitle: 'Celestial 文档',

		// 本地全文搜索，不需要任何外部服务。
		search: {
			provider: 'local',
			options: {
				translations: {
					button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
					modal: {
						displayDetails: '显示详情',
						resetButtonTitle: '清空搜索',
						backButtonTitle: '返回',
						noResultsText: '没有找到结果',
						footer: {
							selectText: '选择',
							selectKeyAriaLabel: '回车',
							navigateText: '切换',
							navigateUpKeyAriaLabel: '上箭头',
							navigateDownKeyAriaLabel: '下箭头',
							closeText: '关闭',
							closeKeyAriaLabel: 'Esc',
						},
					},
				},
			},
		},

		outline: { level: [2, 3], label: '本页目录' },

		nav: [
			{ text: '指南', link: '/guide/why', activeMatch: '^/guide/' },
			{ text: '内容源', link: '/source/manifest', activeMatch: '^/source/' },
			{ text: 'UI 插件', link: '/plugin/manifest-permissions', activeMatch: '^/plugin/' },
			{ text: '参考', link: '/reference/source-api', activeMatch: '^/reference/' },
			{ text: '实例拆解', link: '/cookbook/', activeMatch: '^/cookbook/' },
			{ text: 'FAQ', link: '/faq', activeMatch: '^/faq' },
			{
				text: '插件商店',
				link: 'https://github.com/Wemsur/Celestial-Plugin-Store',
			},
		],

		sidebar: {
			'/guide/': [
				{
					text: '开始之前',
					items: [
						{ text: '为什么有插件系统', link: '/guide/why' },
						{ text: '你该写哪一种', link: '/guide/choosing' },
						{ text: '核心概念', link: '/guide/concepts' },
					],
				},
				{
					text: '动手',
					items: [
						{ text: '15 分钟：第一个内容源', link: '/guide/getting-started-source' },
						{ text: '15 分钟：第一个 UI 插件', link: '/guide/getting-started-plugin' },
						{ text: '项目结构与构建产物', link: '/guide/anatomy' },
						{ text: '装进启动器调试', link: '/guide/local-install' },
					],
				},
				{
					text: '发布',
					items: [{ text: '打包与上架商店', link: '/guide/publishing' }],
				},
			],

			'/source/': [
				{
					text: '内容源',
					items: [
						{ text: '总览', link: '/source/' },
						{ text: 'manifest.json 字段', link: '/source/manifest' },
						{ text: '网络与 hosts 白名单', link: '/source/network' },
						{ text: '七种内容类型', link: '/source/content-types' },
					],
				},
				{
					text: '实现各项能力',
					items: [
						{ text: '搜索与浏览', link: '/source/search-browse' },
						{ text: '详情页', link: '/source/detail' },
						{ text: '版本列表', link: '/source/versions' },
						{ text: '下载地址', link: '/source/resolve-download' },
						{ text: '侧边栏筛选', link: '/source/filters' },
						{ text: '整合包', link: '/source/modpacks' },
						{ text: '更新检查', link: '/source/update-check' },
					],
				},
				{
					text: '进阶',
					items: [
						{ text: '多语言', link: '/source/i18n' },
						{ text: '设置与存储', link: '/source/settings-storage' },
						{ text: '手动条目', link: '/source/manual-entry' },
					],
				},
			],

			'/plugin/': [
				{
					text: 'UI 插件',
					items: [
						{ text: '总览', link: '/plugin/' },
						{ text: 'manifest 与权限', link: '/plugin/manifest-permissions' },
						{ text: 'Vue 与组件', link: '/plugin/vue' },
					],
				},
				{
					text: '扩展启动器',
					items: [
						{ text: '插槽', link: '/plugin/slots' },
						{ text: '自定义页面', link: '/plugin/routes' },
						{ text: '样式', link: '/plugin/styling' },
						{ text: '订阅事件', link: '/plugin/events' },
						{ text: '调用宿主接口', link: '/plugin/hostapi' },
						{ text: '接管结构区域', link: '/plugin/regions' },
						{ text: '设置与存储', link: '/plugin/settings-storage' },
					],
				},
				{
					text: '重型能力',
					items: [
						{ text: '原生 sidecar', link: '/plugin/sidecar' },
						{ text: '局域网联机', link: '/plugin/lan' },
					],
				},
			],

			'/reference/': [
				{
					text: '内容源参考',
					items: [
						{ text: 'api 对象全量', link: '/reference/source-api' },
						{ text: 'provider 全量', link: '/reference/source-provider' },
						{ text: 'manifest 全字段', link: '/reference/manifest-source' },
						{ text: '内容类型表', link: '/reference/content-types' },
					],
				},
				{
					text: 'UI 插件参考',
					items: [
						{ text: 'PluginHostApi 全量', link: '/reference/plugin-api' },
						{ text: 'manifest 全字段', link: '/reference/manifest-plugin' },
						{ text: '权限总表', link: '/reference/permissions' },
						{ text: '插槽清单', link: '/reference/slots' },
						{ text: '事件清单', link: '/reference/events' },
						{ text: '宿主接口清单', link: '/reference/hostapi' },
					],
				},
			],

			'/cookbook/': [
				{
					text: '实例拆解',
					items: [
						{ text: '总览', link: '/cookbook/' },
						{ text: '最小内容源', link: '/cookbook/minimal-source' },
						{ text: '拆解：GitHub Releases 源', link: '/cookbook/github-source' },
						{ text: '拆解：像素茶艺地图源', link: '/cookbook/pixelmap-source' },
						{ text: '拆解：CurseForge 源', link: '/cookbook/curseforge-source' },
						{ text: '拆解：MC百科源', link: '/cookbook/mcmod-source' },
						{ text: '拆解：一言插件', link: '/cookbook/hitokoto-plugin' },
						{ text: '拆解：陶瓦联机插件', link: '/cookbook/terracotta-plugin' },
					],
				},
			],
		},

		socialLinks: [{ icon: 'github', link: 'https://github.com/Wemsur/Celestial-Launcher' }],

		docFooter: { prev: '上一篇', next: '下一篇' },
		darkModeSwitchLabel: '外观',
		sidebarMenuLabel: '目录',
		returnToTopLabel: '回到顶部',
		lastUpdated: {
			text: '最后更新于',
			formatOptions: { dateStyle: 'short', timeStyle: 'short' },
		},

		footer: {
			message: 'Celestial Launcher 基于 Modrinth App 构建，遵循其开源许可。',
			copyright: '插件开发文档',
		},
	},
})
