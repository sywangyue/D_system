/**
 * 知识库的路径改写 —— 纯函数，**客户端与服务端都能引**。
 *
 * 单独放一个文件是因为 lib/knowledge.ts 用了 `fs`（服务端专用），
 * 而渲染 Markdown 的客户端组件同样需要这个函数。从服务端模块引会把 fs 带进客户端包。
 * 拆开而不是复制一份：这段改写规则只该有一处实现（TASK-K §5.1）。
 */

/**
 * 把 Markdown 里的相对路径改写成对外 URL。
 *
 * `images/01.jpg` → `/knowledge/<slug>/images/01.jpg`
 *
 * 不加这一层的话，react-markdown 输出的 `src="images/01.jpg"` 会被浏览器
 * 按当前地址 `/knowledge/<slug>` 解析成 `/knowledge/images/01.jpg` —— 图全裂。
 *
 * 只动相对路径：`http(s)://`、`//`、`/`、`data:` 开头的原样放行。
 * 列表页的 `cover` 与正文插图走的是同一个函数。
 */
export function rewriteAsset(src: string, slug: string): string {
  if (!src) return src
  if (/^(https?:)?\/\//i.test(src) || src.startsWith("/") || src.startsWith("data:")) return src
  return `/knowledge/${slug}/${src.replace(/^\.\//, "")}`
}
