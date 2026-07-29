/*
 * 衣橱业务逻辑层（Service）
 *
 * 职责：编排 repository、做业务判断（如新用户自动灌种子衣橱）。
 * 不写 SQL，不碰 req/res —— 这样 service 才能被脚本和测试直接调用。
 *
 * 每个方法都要求 userId：service 层不允许存在「不带用户的衣橱操作」，
 * 从签名上就堵死漏传的可能。
 */
import * as repo from '../repositories/garmentRepo.mjs'

export function listGarments(userId) {
  return repo.listGarments(userId)
}

export function addGarment(userId, partial) {
  return repo.addGarment(userId, partial)
}

export function deleteGarment(userId, id) {
  return repo.deleteGarment(userId, id)
}

export function toggleFav(userId, id) {
  return repo.toggleFav(userId, id)
}

export function findGarment(userId, id) {
  return repo.findGarment(userId, id)
}

/** 新用户首次登录：衣橱空则灌一份种子数据，保证进去不是白屏 */
export async function ensureSeeded(userId) {
  const n = await repo.countGarments(userId)
  if (n > 0) return 0
  return repo.seedGarmentsForUser(userId)
}
