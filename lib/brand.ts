/**
 * 品牌常量。
 *
 * 「万象」两个字是**字标**（lockup 的一部分），不是界面文案：
 * 它不翻译 —— 英文版直接不渲染它（BrandLockup 的 showCn），
 * 因为渲染这两个字必然要加载 CJK 字体，而英文版要求一个 CJK 字体都不出现
 * （I18N-SPEC §1/§4.2）。
 *
 * 放这里而不是写在组件里：与 tools/build_logo_svg.py 烘进
 * public/brand/logo/*.svg 的是同两个字，两处必须一致；同时组件里
 * 不留中文字面量，「界面零硬编码中文」的扫描才不会被字标干扰。
 */
export const BRAND_CN = "万象"
export const BRAND_LATIN = "MWLAB"
