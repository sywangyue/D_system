"use client"

import Markdown, { defaultUrlTransform } from "react-markdown"
import remarkGfm from "remark-gfm"
import { rewriteAsset } from "@/lib/knowledge-url"

/**
 * 知识库正文渲染。
 *
 * 单独拆成客户端组件的原因只有一个：`react-markdown` 是客户端库。
 * 页面其余部分（标题、徽标、文档列表）都在服务端渲染好，这一块只吃两个字符串。
 *
 * ⚠️ `urlTransform` 是本任务最容易漏的地方（TASK-K §5.1）：
 *    不加它，正文里 `![签约现场](images/02-signing.png)` 会被浏览器按当前地址
 *    `/knowledge/<slug>` 解析成 `/knowledge/images/02-signing.png` —— 图全裂。
 *    真实位置是 `public/knowledge/<slug>/images/02-signing.png`，
 *    对外 URL 是 `/knowledge/<slug>/images/...`。
 *
 * ⚠️ 正文是数据，任何语言下都原样渲染，绝不进字典（§5.5）。
 */
export default function KnowledgeBody({ md, slug }: { md: string; slug: string }) {
  return (
    <article className="prose-cjk rounded-[6px] border border-hairline px-6 py-5">
      <Markdown
        remarkPlugins={[remarkGfm]}
        // 只改写图片的 src。链接的 href 不动：否则 `mailto:`、`#锚点`、`docs/x.pdf`
        // 都会被拼成 /knowledge/<slug>/… 而失效。两者最后都过 defaultUrlTransform ——
        // 自定义 urlTransform 会替换掉 react-markdown 默认的危险协议过滤（javascript: 等），
        // 必须接回来。
        urlTransform={(url, key) =>
          defaultUrlTransform(key === "src" ? rewriteAsset(url, slug) : url)}
      >
        {md}
      </Markdown>
    </article>
  )
}
