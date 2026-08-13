/**
 * 配饰购物车业务层
 *
 * 配饰是全局目录，衣橱衣物按当前用户隔离；两条规则都在写库前校验，
 * 不能把任意 item_id 塞进自己的购物车。
 */
import * as cartRepo from '../repositories/accessoryCartRepo.mjs'
import * as accessoryRepo from '../repositories/accessoryRepo.mjs'
import * as garmentRepo from '../repositories/garmentRepo.mjs'

const ITEM_TYPES = new Set(['garment', 'accessory'])

function quantityOf(value) {
  const quantity = Number(value)
  return Number.isInteger(quantity) && quantity > 0 && quantity <= 99 ? quantity : 1
}

async function validateItem(userId, item) {
  const itemType = String(item.itemType || '')
  const itemId = String(item.itemId || '')
  if (!ITEM_TYPES.has(itemType) || !itemId) {
    const err = new Error('购物车商品参数不完整')
    err.status = 400
    err.code = 'INVALID_CART_ITEM'
    throw err
  }

  const detail = itemType === 'accessory'
    ? await accessoryRepo.findAccessoryById(itemId)
    : await garmentRepo.findGarment(userId, itemId)

  if (!detail) {
    const err = new Error('商品不存在或不属于当前用户')
    err.status = 404
    err.code = 'ITEM_NOT_FOUND'
    throw err
  }

  return {
    itemType,
    itemId,
    quantity: quantityOf(item.quantity),
    sourceOutfitId: item.sourceOutfitId ? String(item.sourceOutfitId) : null,
  }
}

export async function listCart(userId) {
  const rows = await cartRepo.listCartRows(userId)
  const accessoryIds = rows
    .filter((row) => row.item_type === 'accessory')
    .map((row) => row.item_id)
  const garmentIds = rows
    .filter((row) => row.item_type === 'garment')
    .map((row) => row.item_id)

  const [accessories, garments] = await Promise.all([
    accessoryRepo.listAccessoriesByIds(accessoryIds),
    garmentRepo.listGarmentsByIds(userId, garmentIds),
  ])
  const accessoryMap = new Map(accessories.map((item) => [item.id, item]))
  const garmentMap = new Map(garments.map((item) => [item.id, item]))

  const items = rows
    .map((row) => {
      const detail = row.item_type === 'accessory'
        ? accessoryMap.get(row.item_id)
        : garmentMap.get(row.item_id)
      if (!detail) return null
      return {
        cartId: row.id,
        itemType: row.item_type,
        itemId: row.item_id,
        quantity: Number(row.quantity),
        sourceOutfitId: row.source_outfit_id,
        createdAt: row.created_at,
        name: detail.name,
        brand: detail.brand,
        price: detail.price,
        imageUrl: detail.imageUrl || detail.img || '',
        emoji: detail.emoji || '',
        from: detail.primaryColor || detail.from || '#ffd1e8',
        to: detail.secondaryColor || detail.to || '#c9b8ff',
        taobaoUrl: detail.taobaoUrl || '',
        taokouling: detail.taokouling || '',
      }
    })
    .filter(Boolean)

  return { items, count: items.length }
}

export async function addItem(userId, input) {
  const item = await validateItem(userId, input)
  await cartRepo.addCartItem(userId, item)
  return listCart(userId)
}

export async function addBatch(userId, inputs = []) {
  if (!Array.isArray(inputs) || !inputs.length) return listCart(userId)
  const items = []
  for (const input of inputs) {
    items.push(await validateItem(userId, input))
  }
  await cartRepo.batchAddCartItems(userId, items)
  return listCart(userId)
}

export async function removeItem(userId, id) {
  return cartRepo.removeCartItem(userId, id)
}

export async function hasOutfitInCart(userId, garmentIds = []) {
  const ids = Array.from(new Set((garmentIds || []).filter(Boolean).map(String)))
  if (!ids.length) return false
  return (await cartRepo.countCartGarments(userId, ids)) === ids.length
}
