/**
 * 购物车业务层（规格 §4.4 §4.5 §13）
 *
 * 全项目唯一的购物车入口。功能二（整套搭配拆单品）、功能三（配饰）、
 * 功能四（场景新品）都走这里，共用 cart_items 一张表。
 *
 * 三条硬规则：
 *   1. 越权一律 404。衣物按 user_id 隔离；配饰和场景新品是全局目录，
 *      但 cart_items 行本身仍按 user_id 隔离。
 *   2. 价格、名称、淘口令一律从服务端目录重新读，不信客户端传的值
 *      （§4.4「不让客户端伪造购买价格」）。
 *   3. 查不到明细的行不静默丢弃，降级成占位条目并标 available=false，
 *      否则用户会看到「加购成功但购物车是空的」。
 */
import * as cartRepo from '../repositories/cartRepo.mjs'
import * as accessoryRepo from '../repositories/accessoryRepo.mjs'
import * as garmentRepo from '../repositories/garmentRepo.mjs'
import { findCatalogByIds } from '../repositories/sceneRepo.mjs'

const ITEM_TYPES = new Set(['garment', 'accessory', 'catalog'])

function badRequest(message, code) {
  const err = new Error(message)
  err.status = 400
  err.code = code
  return err
}

function notFound(message, code) {
  const err = new Error(message)
  err.status = 404
  err.code = code
  return err
}

function quantityOf(value) {
  const quantity = Number(value)
  return Number.isInteger(quantity) && quantity > 0 && quantity <= cartRepo.MAX_QUANTITY
    ? quantity
    : 1
}

/** 按 item_type 去对应目录取明细；找不到返回 null */
async function findDetail(userId, itemType, itemId) {
  if (itemType === 'accessory') return accessoryRepo.findAccessoryById(itemId)
  if (itemType === 'garment') return garmentRepo.findGarment(userId, itemId)
  const [catalog] = await findCatalogByIds([itemId])
  return catalog || null
}

async function validateItem(userId, item) {
  const itemType = String(item.itemType || '')
  const itemId = String(item.itemId || '')
  if (!ITEM_TYPES.has(itemType) || !itemId) {
    throw badRequest('购物车商品参数不完整', 'INVALID_CART_ITEM')
  }
  const detail = await findDetail(userId, itemType, itemId)
  if (!detail) {
    throw notFound('商品不存在或不属于当前用户', 'ITEM_NOT_FOUND')
  }
  return {
    itemType,
    itemId,
    quantity: quantityOf(item.quantity),
    sourceOutfitId: item.sourceOutfitId ? String(item.sourceOutfitId) : null,
  }
}

/** 三种目录的字段名不统一，在这里抹平成购物车行的统一形状 */
function toCartItem(row, detail) {
  const base = {
    cartId: Number(row.id),
    itemType: row.item_type,
    itemId: row.item_id,
    quantity: Number(row.quantity),
    sourceOutfitId: row.source_outfit_id === null ? null : String(row.source_outfit_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
  if (!detail) {
    // 目录里的商品被删了（或历史脏数据）。保留行并标记不可用，
    // 让用户能看见并自行删除，而不是无声消失。
    return {
      ...base,
      available: false,
      name: '商品已下架',
      brand: '',
      price: null,
      imageUrl: '',
      emoji: '',
      from: '#e8e8ee',
      to: '#c9c9d4',
      taobaoUrl: '',
      taokouling: '',
    }
  }
  return {
    ...base,
    available: true,
    name: detail.name || '',
    brand: detail.brand || '',
    price: detail.price === undefined || detail.price === null ? null : Number(detail.price),
    imageUrl: detail.imageUrl || detail.img || '',
    emoji: detail.emoji || '',
    from: detail.primaryColor || detail.from || '#ffd1e8',
    to: detail.secondaryColor || detail.to || '#c9b8ff',
    taobaoUrl: detail.taobaoUrl || '',
    taokouling: detail.taokouling || '',
  }
}

export async function listCart(userId) {
  const rows = await cartRepo.listCartRows(userId)
  const idsOf = (type) => rows.filter((row) => row.item_type === type).map((row) => row.item_id)

  // 三个目录并发查，避免 N+1
  const [accessories, garments, catalog] = await Promise.all([
    accessoryRepo.listAccessoriesByIds(idsOf('accessory')),
    garmentRepo.listGarmentsByIds(userId, idsOf('garment')),
    findCatalogByIds(idsOf('catalog')),
  ])
  const maps = {
    accessory: new Map(accessories.map((item) => [item.id, item])),
    garment: new Map(garments.map((item) => [item.id, item])),
    catalog: new Map(catalog.map((item) => [item.id, item])),
  }

  const items = rows.map((row) => toCartItem(row, maps[row.item_type]?.get(row.item_id)))
  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = items.reduce(
    (sum, item) => sum + (item.price || 0) * item.quantity,
    0,
  )
  return { items, count, totalPrice }
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

/**
 * 整套搭配拆成单品写入购物车，并记录来源搭配（规格 §4.5 §8.9）。
 * 搭配不存在或不属于当前用户 → 404。
 */
export async function addOutfitToCart(userId, outfitId) {
  const garmentIds = await cartRepo.listOutfitGarmentIds(userId, outfitId)
  if (garmentIds === null) {
    throw notFound('搭配不存在或不属于当前用户', 'OUTFIT_NOT_FOUND')
  }
  await cartRepo.batchAddCartItems(
    userId,
    garmentIds.map((garmentId) => ({
      itemType: 'garment',
      itemId: garmentId,
      quantity: 1,
      sourceOutfitId: String(outfitId),
    })),
  )
  return listCart(userId)
}

/** 场景新品批量入车（功能四）。旧衣不进购买清单，调用方只传新品 id。 */
export async function addCatalogItems(userId, itemIds = [], sourceOutfitId = null) {
  const ids = Array.from(new Set((itemIds || []).filter(Boolean).map(String)))
  if (!ids.length) return { added: [], ignored: [] }
  const catalog = await findCatalogByIds(ids)
  const found = new Set(catalog.map((item) => item.id))

  await cartRepo.batchAddCartItems(
    userId,
    catalog.map((item) => ({
      itemType: 'catalog',
      itemId: item.id,
      quantity: 1,
      sourceOutfitId: sourceOutfitId ? String(sourceOutfitId) : null,
    })),
  )

  return {
    added: catalog.map((item) => ({
      itemId: item.id,
      name: item.name,
      price: item.price,
      taokouling: item.taokouling,
    })),
    ignored: ids.filter((id) => !found.has(id)),
  }
}

export async function setCartQuantity(userId, id, quantity) {
  const row = await cartRepo.setCartQuantity(userId, id, quantity)
  if (!row) {
    throw notFound('购物车商品不存在', 'CART_ITEM_NOT_FOUND')
  }
  const detail = await findDetail(userId, row.item_type, row.item_id)
  return toCartItem(row, detail)
}

export async function removeItem(userId, id) {
  return cartRepo.removeCartItem(userId, id)
}

/** 保留抛错版本给功能二的既有调用方（DELETE /api/cart/:id） */
export async function deleteCartItem(userId, id) {
  const ok = await cartRepo.removeCartItem(userId, id)
  if (!ok) {
    throw notFound('购物车商品不存在', 'CART_ITEM_NOT_FOUND')
  }
  return ok
}

/**
 * 功能三搭配优惠（规格 §9.7）：购物车是否已包含当前搭配的全部服装。
 * 全部命中才算，缺一件就是原价。
 */
export async function hasOutfitInCart(userId, garmentIds = []) {
  const ids = Array.from(new Set((garmentIds || []).filter(Boolean).map(String)))
  if (!ids.length) return false
  return (await cartRepo.countCartGarments(userId, ids)) === ids.length
}
