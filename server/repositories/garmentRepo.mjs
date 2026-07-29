/**
 * 服装仓库 — 衣物 CRUD 操作。
 * 支持 SQLite（同步）和 MySQL（异步），根据 db.mjs 导出的 isMysql 自动适配。
 */
import { listGarments, addGarment, deleteGarment, toggleFav,
         listGarmentsAsync, addGarmentAsync, deleteGarmentAsync, toggleFavAsync,
         isMysql } from '../db.mjs'

// 行转换已在 db.mjs 中完成，这里直接透传

export function listGarmentsFn() {
  return isMysql ? listGarmentsAsync() : listGarments()
}

export function addGarmentFn(partial) {
  return isMysql ? addGarmentAsync(partial) : addGarment(partial)
}

export function deleteGarmentFn(id) {
  return isMysql ? deleteGarmentAsync(id) : deleteGarment(id)
}

export function toggleFavFn(id) {
  return isMysql ? toggleFavAsync(id) : toggleFav(id)
}
