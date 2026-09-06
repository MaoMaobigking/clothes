/**
 * Day1 + Day2 验收脚本：真用户 + 真隔离
 *
 * 用法：cd server && npm run db:check
 *
 * 验的是「五个真」里的前三个，全程不看代码只看数据库和返回值：
 *   1. 真用户：两个不同 code 登录 → 两个不同 userId，users 表真多两行
 *   2. 真落库：新用户各自拿到独立衣橱副本，条数进了 garments 表
 *   3. 真隔离：A 看不到 B 的衣物；A 删/收藏 B 的衣物一律失败（上层返 404）
 *
 * 直接调 service 层而不是发 HTTP：不用先起服务器，跑得快，
 * 而且能顺手断言数据库里的真实行数 —— 接口返回值可以骗人，行数不会。
 */
import { wxLogin } from '../services/auth/index.mjs'
import * as garmentService from '../services/garmentService.mjs'
import { getOne, getAll, closeDb, initDb } from '../db/mysql.mjs'

let failed = 0
function check(label, ok, extra = '') {
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${extra ? ' — ' + extra : ''}`)
  if (!ok) failed++
}

await initDb()

// 用带时间戳的 code，保证每次跑都是全新用户，不受上一次残留影响
const stamp = Date.now().toString(36)
const codeA = `acceptA_${stamp}`
const codeB = `acceptB_${stamp}`

console.log('\n【1】真用户：两个 code → 两个真实 userId')
const before = await getOne('SELECT COUNT(*) AS n FROM users')
const a = await wxLogin(codeA)
const b = await wxLogin(codeB)
const after = await getOne('SELECT COUNT(*) AS n FROM users')

check('userId 不同', a.userId !== b.userId, `A=${a.userId} B=${b.userId}`)
check('userId 不是写死的 1', a.userId !== 1 || b.userId !== 1)
check('users 表真的多了 2 行', Number(after.n) - Number(before.n) === 2, `${before.n} → ${after.n}`)
check('两人都签出了 token', Boolean(a.token && b.token && a.token !== b.token))

console.log('\n【1b】同一个 code 重复登录不该建新用户（openid 幂等）')
const a2 = await wxLogin(codeA)
const after2 = await getOne('SELECT COUNT(*) AS n FROM users')
check('userId 与首次一致', a2.userId === a.userId, `${a.userId} vs ${a2.userId}`)
check('users 表行数没变', Number(after2.n) === Number(after.n))

console.log('\n【2】真落库：各自有独立衣橱副本')
const listA = await garmentService.listGarments(a.userId)
const listB = await garmentService.listGarments(b.userId)
const rowsA = await getAll('SELECT id FROM garments WHERE user_id = ?', [a.userId])
check('A 衣橱非空', listA.length > 0, `${listA.length} 件`)
check('B 衣橱非空', listB.length > 0, `${listB.length} 件`)
check('接口条数 == 库里行数', listA.length === rowsA.length)
const idsA = new Set(listA.map((g) => g.id))
const overlap = listB.filter((g) => idsA.has(g.id))
check('两人衣物 id 完全不重叠（不是共用同一批行）', overlap.length === 0, `重叠 ${overlap.length} 件`)

console.log('\n【3】真隔离：跨用户读写全部打空')
const targetB = listB[0]
const crossRead = await garmentService.findGarment(a.userId, targetB.id)
check('A 查 B 的衣物 → null（上层返 404）', crossRead === null)

const crossDel = await garmentService.deleteGarment(a.userId, targetB.id)
check('A 删 B 的衣物 → false', crossDel === false)
const stillThere = await getOne('SELECT id FROM garments WHERE id = ?', [targetB.id])
check('B 的衣物仍在库里（没被真删掉）', Boolean(stillThere))

const crossFav = await garmentService.toggleFav(a.userId, targetB.id)
check('A 收藏 B 的衣物 → null', crossFav === null)
const favRow = await getOne('SELECT fav FROM garments WHERE id = ?', [targetB.id])
check('B 的收藏状态没被改动', Boolean(favRow.fav) === Boolean(targetB.fav))

console.log('\n【3b】自己的资源必须能正常操作（别把隔离做成谁都不能动）')
const own = listA[0]
const favNew = await garmentService.toggleFav(a.userId, own.id)
check('A 收藏自己的衣物 → 状态翻转', favNew === !own.fav, `${own.fav} → ${favNew}`)
const delOwn = await garmentService.deleteGarment(a.userId, own.id)
check('A 删自己的衣物 → true', delOwn === true)
const gone = await getOne('SELECT id FROM garments WHERE id = ?', [own.id])
check('库里确实没了', gone === null)

console.log(failed === 0 ? '\n🎉 全部通过：真用户 / 真落库 / 真隔离 三项成立\n' : `\n❌ ${failed} 项未通过\n`)
process.exitCode = failed === 0 ? 0 : 1
await closeDb()
