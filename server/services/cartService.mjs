import * as repo from '../repositories/cartRepo.mjs'

export function listCart(userId) {
  return repo.listCart(userId)
}

export async function addOutfitToCart(userId, outfitId) {
  const items = await repo.addOutfitToCart(userId, outfitId)
  if (items === null) {
    const err = new Error('搭配不存在或不属于当前用户')
    err.status = 404
    err.code = 'OUTFIT_NOT_FOUND'
    throw err
  }
  return items
}

export async function deleteCartItem(userId, id) {
  const ok = await repo.deleteCartItem(userId, id)
  if (!ok) {
    const err = new Error('购物车商品不存在')
    err.status = 404
    err.code = 'CART_ITEM_NOT_FOUND'
    throw err
  }
  return ok
}

export async function setCartQuantity(userId, id, quantity) {
  const item = await repo.setCartQuantity(userId, id, quantity)
  if (!item) {
    const err = new Error('购物车商品不存在')
    err.status = 404
    err.code = 'CART_ITEM_NOT_FOUND'
    throw err
  }
  return item
}
