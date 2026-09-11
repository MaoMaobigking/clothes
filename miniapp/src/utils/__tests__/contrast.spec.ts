import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  WCAG_AA_NON_TEXT,
  WCAG_AA_NORMAL,
  contrastRatio,
  extractHexTokens,
  parseHex,
  relativeLuminance,
  wcagVerdict,
} from '../contrast'

describe('对比度计算本身', () => {
  it('极端值：黑白是 21:1，同色是 1:1', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#7f7f7f', '#7f7f7f')).toBeCloseTo(1, 5)
  })

  it('参数顺序无关', () => {
    expect(contrastRatio('#303133', '#fff')).toBeCloseTo(contrastRatio('#fff', '#303133'), 10)
  })

  it('三位和六位写法等价', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255])
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(contrastRatio('#ffffff', '#000000'), 10)
  })

  it('必须做 gamma 反变换：中灰 #808080 的相对亮度约 0.216，不是 0.5', () => {
    // 省掉这一步是最常见的错法，会让暗色组算得偏高（测出来合格、实际看不清）
    expect(relativeLuminance('#808080')).toBeCloseTo(0.2159, 3)
  })

  it('非法输入返回 NaN，不抛也不悄悄当成黑色', () => {
    expect(contrastRatio('不是颜色', '#fff')).toBeNaN()
    expect(parseHex('#ff')).toBeNull()
  })

  it('定级门槛', () => {
    expect(wcagVerdict(21)).toBe('AAA')
    expect(wcagVerdict(4.5)).toBe('AA')
    expect(wcagVerdict(3)).toBe('AA-large')
    expect(wcagVerdict(2.99)).toBe('fail')
  })
})

/*
 * 下面这一组是**设计令牌的实测**，不是算法测试。
 *
 * 直接从 tokens.css 读值，不在测试里抄一份硬编码的 hex ——
 * 抄一份就等于埋一个「改了颜色测试还绿着」的雷，而这正是要防的事。
 */
const css = readFileSync(fileURLToPath(new URL('../../styles/tokens.css', import.meta.url)), 'utf8')
const T = extractHexTokens(css)
const color = (name: string) => {
  const v = T[name]
  if (!v) throw new Error(`tokens.css 里找不到 --${name}`)
  return v
}

describe('设计令牌 · 文字对比度（WCAG 2.1 AA）', () => {
  // 正文文字必须在**两种底**上都达标：卡片白底和页面灰底
  it.each([
    ['text-1', '标题 / 正文'],
    ['text-2', '次要说明 / 右侧值'],
    ['text-3', '占位符 / 辅助文字'],
  ])('--%s（%s）在卡片底和页面底上都 ≥ 4.5:1', (token) => {
    const onCard = contrastRatio(color(token), color('surface'))
    const onPage = contrastRatio(color(token), color('bg-page'))
    expect(onCard, `${color(token)} on ${color('surface')}`).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
    expect(onPage, `${color(token)} on ${color('bg-page')}`).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })

  it('--text-3 是本次自查唯一改动的值：原 uv-ui 值 #909193 确实不达标', () => {
    // 保留这条是为了让「为什么偏离 uv-ui 原值」有据可查，而不是凭印象
    expect(contrastRatio('#909193', color('bg-page'))).toBeLessThan(WCAG_AA_NORMAL)
    expect(contrastRatio(color('text-3'), color('bg-page'))).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })
})

/*
 * ── 已知不达标、且**决定不改**的几组 ──
 *
 * 用测试把它们钉住，而不是写在文档里等人忘记。断言方向是「仍然不达标」：
 * 哪天有人把主色调深了，这里会红，提醒回来把豁免说明一起删掉。
 */
describe('设计令牌 · 已知不达标（记录在案，非回归）', () => {
  it('--text-4 禁用态 1.75:1 —— WCAG 1.4.3 明确豁免禁用控件，不改', () => {
    expect(contrastRatio(color('text-4'), color('surface'))).toBeLessThan(WCAG_AA_NORMAL)
  })

  it('--line 分隔线 1.38:1 —— 纯装饰性分隔，不承载信息，不适用 1.4.11', () => {
    expect(contrastRatio(color('line'), color('surface'))).toBeLessThan(WCAG_AA_NON_TEXT)
  })

  /*
   * 这三条是**真问题**，不是豁免：
   *   主色当文字用（--purple-deep 别名，54 处 color 调用点）  2.89:1
   *   主色按钮上的白字（全站主 CTA）                          2.89:1
   *   语义色当文字用（danger / success / warning）            1.88 ~ 2.90:1
   *
   * 不在这一批改，原因是改主色是**设计决策**不是修 bug：它会动到全站观感，
   * 而 tokens.css 的注释记录了这套配色已经过两轮换皮定稿。
   * 记在这里 + 测试钉住精确比值，等设计侧拍板。
   * 若要改：主色压到 #c24677（原值的 76%）可得 4.73:1 过 AA。
   */
  it.each([
    ['purple-deep', 'surface', '主色当强调文字（54 处）'],
    ['text-on-brand', 'pink-deep', '主色按钮上的白字（全站主 CTA）'],
    ['danger', 'surface', '错误提示文字'],
    ['success', 'surface', '成功提示文字'],
    ['warning', 'surface', '警告提示文字'],
  ])('%s on %s 仍不达标 —— %s', (fg, bg) => {
    expect(contrastRatio(color(fg), color(bg))).toBeLessThan(WCAG_AA_NORMAL)
  })

  it('参考值：主色压到 #c24677 就能过 AA（给设计侧的备选，非当前值）', () => {
    expect(contrastRatio('#c24677', '#fff')).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })
})
