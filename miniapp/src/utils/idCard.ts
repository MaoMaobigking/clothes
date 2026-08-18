/*
 * 身份证号校验（GB 11643-1999 校验位算法）。
 *
 * ── 为什么手写而不是装 id-validator ──
 * mc-zone/IDValidator（npm 上的 id-validator）是这块最经典的库，但 1.3.0 已经九年没更新。
 * 它相对手写校验的唯一增量是 GB 2260 行政区划地址库 —— 数据早就滞后于现实的区划调整，
 * 还得额外背一份 JSON 进本来就超标的主包。而这里是明示「不做真实核验」的演示表单，
 * 把号码前 6 位解析成「某某省某某区」既没用也可能是错的。
 *
 * 校验位算法本身是冻结的国标：权重表和校验字符表二十多年没变过，
 * 抄一段不会变的国标不算重复造轮子。
 *
 * ── 强校验能证明什么、不能证明什么 ──
 * 通过校验 = 这串号码「符合编码规则」。但符合规则的号码可以按规则批量生成，
 * 所以**校验通过不等于这个号码真实存在、更不等于它属于填表的人**。
 * 真实核验要走公安部/运营商的三要素比对接口，需要企业资质。
 * 这就是界面上那句「演示功能，不做真实核验」的技术依据。
 */

/** 前 17 位的加权因子，来自 GB 11643 附录 A */
const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
/** 加权和模 11 之后查这张表得到第 18 位；余数 2 对应字符 'X'（罗马数字 10） */
const CHECK_CHARS = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']

export interface IdCardInfo {
  ok: boolean
  /** 校验失败时给一句能照着改的话，不是笼统的「格式错误」 */
  message: string
  /** 出生日期 YYYY-MM-DD，仅在 ok 时有值 */
  birthday?: string
  /** 第 17 位奇男偶女，仅在 ok 时有值 */
  gender?: '男' | '女'
}

/** 出生日期段必须是真日期：2 月 30 号能过正则，过不了这一关 */
function parseBirthday(raw: string): string | null {
  const year = Number(raw.slice(0, 4))
  const month = Number(raw.slice(4, 6))
  const day = Number(raw.slice(6, 8))
  const thisYear = new Date().getFullYear()
  if (year < 1900 || year > thisYear) return null
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}

/**
 * 校验 18 位身份证号。
 * 只支持 18 位：15 位的老号 1999 年就停止发放了，演示表单没必要背这个兼容。
 */
export function validateIdCard(input: string): IdCardInfo {
  const id = String(input || '').trim().toUpperCase()
  if (!id) return { ok: false, message: '请输入身份证号' }
  if (id.length !== 18) return { ok: false, message: '身份证号应为 18 位' }
  if (!/^\d{17}[\dX]$/.test(id)) {
    return { ok: false, message: '前 17 位必须是数字，最后一位是数字或 X' }
  }

  const birthday = parseBirthday(id.slice(6, 14))
  if (!birthday) return { ok: false, message: '第 7–14 位不是有效的出生日期' }

  const sum = WEIGHTS.reduce((acc, weight, index) => acc + Number(id[index]) * weight, 0)
  const expected = CHECK_CHARS[sum % 11]
  if (id[17] !== expected) {
    return { ok: false, message: `校验位不对，最后一位应该是 ${expected}` }
  }

  return {
    ok: true,
    message: '',
    birthday,
    gender: Number(id[16]) % 2 === 1 ? '男' : '女',
  }
}

/** 手机号：只做 11 位国内号段的粗校验，演示表单不接三要素比对 */
export function validatePhone(input: string): boolean {
  return /^1[3-9]\d{9}$/.test(String(input || '').trim())
}

/** 中文姓名，含少数民族名字里的间隔号「·」 */
export function validateRealName(input: string): boolean {
  return /^[一-龥·]{2,16}$/.test(String(input || '').trim())
}

/** 存档和回显都用脱敏后的号，明文不落任何存储 */
export function maskIdCard(id: string): string {
  const value = String(id || '').trim()
  if (value.length !== 18) return value
  return `${value.slice(0, 6)}********${value.slice(-4)}`
}

export function maskPhone(phone: string): string {
  const value = String(phone || '').trim()
  if (value.length !== 11) return value
  return `${value.slice(0, 3)}****${value.slice(-4)}`
}
