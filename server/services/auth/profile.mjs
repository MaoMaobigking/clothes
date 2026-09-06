/**
 * 个人资料读写（规格 §11.2）：昵称与预设头像。
 */
import { findById, updateUserProfile } from '../../repositories/userRepo.mjs'
/* ============ 规格 §11.2：编辑资料（昵称 + 预设头像） ============ */

const NICKNAME_MAX = 16

/** 按码点数，不用 .length —— emoji 在 UTF-16 里占 2 格，会把 8 个字的昵称判成超长 */
function normalizeNickname(raw) {
  const value = String(raw ?? '').trim()
  if (!value) {
    const err = new Error('昵称不能为空')
    err.status = 400
    err.code = 'NICKNAME_EMPTY'
    throw err
  }
  if ([...value].length > NICKNAME_MAX) {
    const err = new Error(`昵称最多 ${NICKNAME_MAX} 个字`)
    err.status = 400
    err.code = 'NICKNAME_TOO_LONG'
    throw err
  }
  return value
}

/**
 * 头像存的是一个 emoji，不是图片 URL。
 *
 * 因为 users.avatar_url 早就被社群那条链路当文本直接渲染了
 * （communityRepo 里 `authorAvatar: row.avatar_url || '🧑‍🎨'`，
 * share-detail 页 `<text class="avatar">{{ authorAvatar }}</text>`）。
 * 往里塞 URL 的话，社群列表会显示一串裸链接。
 * 「我的」页那边用 utils/icons 的 iconForEmoji 把它换成线性图标，两边都对。
 *
 * 校验只做「短且不含 ASCII」：足够挡住把一段文字或链接塞进头像，
 * 又不用把前端那组预设 emoji 抄一份到服务端 —— 抄了两边就会漂。
 */
function normalizeAvatar(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  // eslint-disable-next-line no-control-regex
  if ([...value].length > 4 || /[\x00-\x7f]/.test(value)) {
    const err = new Error('头像只能是一个表情')
    err.status = 400
    err.code = 'AVATAR_INVALID'
    throw err
  }
  return value
}

/** 对外可见的用户字段。password_hash / openid 不在里面，别往回加。 */
function publicUser(user) {
  return {
    userId: user.id,
    account: user.account || '',
    nickname: user.nickname || '',
    avatarUrl: user.avatar_url || '',
    role: user.role || 'user',
    membershipLevel: user.membership_level || '',
    demoKind: user.demo_kind || null,
  }
}

export async function getMyProfile(userId) {
  const user = await findById(userId)
  if (!user) {
    const err = new Error('用户不存在')
    err.status = 404
    err.code = 'USER_NOT_FOUND'
    throw err
  }
  return publicUser(user)
}

/**
 * 改昵称 / 头像。只认这两个字段 —— 仓库层的 updateUserProfile 也只拼这两个，
 * 前端多传 role 之类的东西不会有任何效果。
 *
 * 不看 updateUserProfile 的返回值：值没变化时 MySQL 的 affectedRows 是 0，
 * 拿它当「更新失败」判断的话，把昵称改成和原来一样就会报错。
 */
export async function updateMyProfile(userId, payload = {}) {
  const patch = {}
  if (payload.nickname !== undefined) patch.nickname = normalizeNickname(payload.nickname)
  if (payload.avatarUrl !== undefined) patch.avatarUrl = normalizeAvatar(payload.avatarUrl)
  if (!Object.keys(patch).length) {
    const err = new Error('没有要修改的内容')
    err.status = 400
    err.code = 'PROFILE_NOTHING_TO_UPDATE'
    throw err
  }
  await updateUserProfile(userId, patch)
  return getMyProfile(userId)
}
