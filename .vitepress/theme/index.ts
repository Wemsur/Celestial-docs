import DefaultTheme from 'vitepress/theme'
import './custom.css'

import { onMounted, watch, nextTick, h } from 'vue'
import { useRoute } from 'vitepress'

// 把 .mermaid 容器渲染成 SVG。容器的 data-graph 属性里是 encodeURIComponent
// 过的图表源码（见 .vitepress/config.mts 里的 fence 规则）。
//
// mermaid 用动态 import，只在页面里真的有图时才加载——它是约 1 MB 的大包，
// 不该让每个页面都背上。
async function renderMermaid() {
	const nodes = Array.from(document.querySelectorAll<HTMLElement>('.mermaid'))
	const pending = nodes.filter((node) => node.dataset.mermaidRendered !== 'true')
	if (pending.length === 0) return

	const { default: mermaid } = await import('mermaid')

	mermaid.initialize({
		startOnLoad: false,
		// 图表里会出现中文和中文标点，默认的 strict 会拦掉一部分。
		securityLevel: 'loose',
		theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
		fontFamily: 'inherit',
	})

	for (const [index, node] of pending.entries()) {
		const graph = decodeURIComponent(node.dataset.graph ?? '')
		if (!graph.trim()) continue
		try {
			const { svg } = await mermaid.render(`mermaid-${index}-${Date.now()}`, graph)
			node.innerHTML = svg
			node.dataset.mermaidRendered = 'true'
		} catch (error) {
			// 语法错误时把原文留在页面上，比一个空框有用。
			node.textContent = `Mermaid 渲染失败：${
				error instanceof Error ? error.message : String(error)
			}\n\n${graph}`
			node.dataset.mermaidRendered = 'true'
		}
	}
}

export default {
	...DefaultTheme,
	setup() {
		const route = useRoute()

		onMounted(() => {
			void nextTick(() => void renderMermaid())
		})

		// 路由切换后是新页面，重新扫一遍。
		watch(
			() => route.path,
			() => void nextTick(() => void renderMermaid()),
		)
	},
	Layout: () => h(DefaultTheme.Layout),
}
