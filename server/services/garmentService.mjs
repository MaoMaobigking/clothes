/*
 * 衣橱业务逻辑层
 *  - 支持 SQLite（同步）和 MySQL（异步）
 */
import { listGarmentsFn, addGarmentFn, deleteGarmentFn, toggleFavFn } from '../repositories/garmentRepo.mjs'

export function listGarments() {
  return listGarmentsFn()
}

export function addGarment(partial) {
  return addGarmentFn(partial)
}

export function deleteGarment(id) {
  return deleteGarmentFn(id)
}

export function toggleFav(id) {
  return toggleFavFn(id)
}
