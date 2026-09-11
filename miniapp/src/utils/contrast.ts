/**
 * 颜色对比度计算 —— 纯函数，按 WCAG 2.1 的定义实现。
 *
 * 为什么要有这个：设计令牌里有四档文字色、若干面色，哪几组搭起来够不够看
 * **不能靠眼睛判断** —— 浅灰配白看着「能看清」，量出来往往只有 2.8:1，
 * 对低视力用户和强光下的手机屏就是读不了。
 *
 * 为什么做成可测的函数而不是用在线工具量一遍：量一遍是一次性的，
 * 下次有人调 --text-3 的值，没人会想起再去量。做成测试就是每次 CI 都在量。
 *
 * ⚠️ 这是**设计期工具**，App 运行时不引用它。没有调用点，打包时会被摇掉。
 */

/** #rgb / #rrggbb → [r, g, b]，各 0–255。解析不了返回 null（不抛，调用方自己决定怎么办） */
export function parseHex(hex: string): [number, number, number] | null {
  const s = hex.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(s)) {
    return [parseInt(s[0] + s[0], 16), parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16)]
  }
  if (/^[0-9a-f]{6}$/i.test(s)) {
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
  }
  return null
}

/**
 * 相对亮度。
 *
 * 注意那个 gamma 反变换（除以 12.92 还是走 2.4 次幂）：**不能省**。
 * 直接拿 0–255 的值算加权平均是最常见的错法 —— 因为 sRGB 是非线性的，
 * 中灰在数值上是 128，在光度上只有 0.216。省了这一步，暗色组会算得偏高，
 * 于是「测出来合格、实际看不清」。
 */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex)
  if (!rgb) return NaN
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  // 三个系数是人眼对三原色的敏感度，绿色占七成
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 两色对比度，1–21。参数顺序无关 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  if (Number.isNaN(la) || Number.isNaN(lb)) return NaN
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * WCAG 门槛。
 *
 * 「大字」= 18pt 以上，或 14pt 以上的粗体（约 24px / 18.66px 粗体）。
 * 本项目用 rpx，750rpx 设计稿下 1rpx ≈ 0.5px，所以 --fs-xl(32rpx≈16px) 仍算小字。
 * 别拿「我这是标题」当理由套大字门槛，先换算。
 */
export const WCAG_AA_NORMAL = 4.5
export const WCAG_AA_LARGE = 3
/** 非文字元素（图标、输入框边框、开关）也有门槛，同样是 3:1 */
export const WCAG_AA_NON_TEXT = 3

export type WcagVerdict = 'AAA' | 'AA' | 'AA-large' | 'fail'

/** 给一个比值定级，方便在测试和文档里直接打印 */
export function wcagVerdict(ratio: number): WcagVerdict {
  if (ratio >= 7) return 'AAA'
  if (ratio >= WCAG_AA_NORMAL) return 'AA'
  if (ratio >= WCAG_AA_LARGE) return 'AA-large'
  return 'fail'
}

/** 从 CSS 文本里抽出 `--name: #hex` 形式的颜色令牌。抽不到的（渐变、rgb()）跳过 */
export function extractHexTokens(css: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*(?:;|$)/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(css)) !== null) {
    // 同名后出现的覆盖先出现的，和 CSS 的层叠一致
    out[m[1]] = m[2]
  }
  return out
}
