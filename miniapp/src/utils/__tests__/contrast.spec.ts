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
    ['pink-deep', '主色当强调文字（104 处 color）'],
    ['purple-deep', '主色别名'],
    ['price', '价格'],
    ['danger', '错误提示文案'],
    ['success', '成功提示'],
    ['warning', '警告提示'],
  ])('--%s（%s）在卡片底和页面底上都 ≥ 4.5:1', (token) => {
    const onCard = contrastRatio(color(token), color('surface'))
    const onPage = contrastRatio(color(token), color('bg-page'))
    expect(onCard, `${color(token)} on ${color('surface')}`).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
    expect(onPage, `${color(token)} on ${color('bg-page')}`).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })

  it('主色落在 chip 的浅粉底上也要达标 —— 这是三个底里最紧的一个', () => {
    // .chip 是 color:--pink-deep + background:--pink-soft，别只测白底就以为过了
    expect(contrastRatio(color('pink-deep'), color('pink-soft'))).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })

  it('主按钮的白字：.btn-primary 是 --text-on-brand on --brand-gradient', () => {
    /*
     * 对比度是对称的 —— 同一个比值既决定「粉色文字读不读得了」，
     * 也决定「按钮上的白字读不读得了」。原来两边都是 2.89:1。
     */
    expect(contrastRatio(color('text-on-brand'), color('brand-gradient'))).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })

  it('主色和它的三个别名必须同值 —— 分叉了全站会同时出现两支粉', () => {
    for (const alias of ['purple-deep', 'purple', 'pink', 'price', 'brand-gradient']) {
      expect(color(alias), `--${alias}`).toBe(color('pink-deep'))
    }
  })

  it('tabBar 的选中色必须跟着主色走 —— 它在 pages.json 里，CSS 变量够不着', () => {
    /*
     * 改主色时最容易漏的就是这类**读不到 CSS 变量的地方**：
     * tabBar 配置、canvas 画海报、ECharts 的 option、uni.showModal 的 confirmColor。
     * 它们只能写死 hex，改色时漏一个就是全站两支粉，而且 CSS 那边的测试查不到。
     * 这条只钉住最显眼的 tabBar，其余靠 tokens.css 顶部的同步提醒。
     */
    const pagesJson = readFileSync(fileURLToPath(new URL('../../pages.json', import.meta.url)), 'utf8')
    const selected = /"selectedColor"\s*:\s*"(#[0-9a-fA-F]{3,8})"/.exec(pagesJson)?.[1]
    expect(selected?.toLowerCase()).toBe(color('pink-deep').toLowerCase())
  })

  it('tabBar 的未选中色也要跟着 --text-3 走，且在白色 tabBar 底上达标', () => {
    // 原来写死的是 --text-3 的旧值 #909193（3.15:1），--text-3 改了它没跟上
    const pagesJson = readFileSync(fileURLToPath(new URL('../../pages.json', import.meta.url)), 'utf8')
    const unselected = /"color"\s*:\s*"(#[0-9a-fA-F]{3,8})"/.exec(pagesJson)?.[1]
    expect(unselected?.toLowerCase()).toBe(color('text-3').toLowerCase())
    expect(contrastRatio(unselected!, '#ffffff')).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })

  it.each([
    ['text-3', '#909193'],
    ['pink-deep', '#ff5c9d'],
    ['danger', '#f56c6c'],
    ['success', '#5ac725'],
    ['warning', '#f9ae3d'],
  ])('--%s 偏离上游原值 %s 是有据的：原值确实不达标', (token, original) => {
    // 保留这组是为了让「为什么不照抄 uv-ui / 为什么动品牌色」有据可查，而不是凭印象
    expect(contrastRatio(original, color('surface'))).toBeLessThan(WCAG_AA_NORMAL)
    expect(contrastRatio(color(token), color('surface'))).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })
})

/*
 * ── 已知不达标、且**决定不改**的几组 ──
 *
 * 用测试把它们钉住，而不是写在文档里等人忘记。断言方向是「仍然不达标」：
 * 哪天有人把它们调深了，这里会红，提醒回来把豁免说明一起删掉。
 */
describe('设计令牌 · 已知不达标（记录在案，非回归）', () => {
  it('--text-4 禁用态 1.75:1 —— WCAG 1.4.3 明确豁免禁用控件，不改', () => {
    expect(contrastRatio(color('text-4'), color('surface'))).toBeLessThan(WCAG_AA_NORMAL)
  })

  it('--line 分隔线 1.38:1 —— 纯装饰性分隔，不承载信息，不适用 1.4.11', () => {
    expect(contrastRatio(color('line'), color('surface'))).toBeLessThan(WCAG_AA_NON_TEXT)
  })

  it('--info 3.08:1 —— 只到 AA-large，调用点都是大字号且不承载操作，暂不改', () => {
    const r = contrastRatio(color('info'), color('surface'))
    expect(r).toBeLessThan(WCAG_AA_NORMAL)
    expect(r).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT)
  })
})
