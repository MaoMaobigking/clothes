/**
 * 配饰购物车业务层 —— 已弃用（规格 §4.5 §13）
 *
 * 购物车已统一到 services/cartService.mjs 与 cart_items 单表。
 * 本文件只是薄转发层，保留给两处既有调用方：
 *   - 前端 miniapp/src/api/accessories.ts 的 /api/accessory-cart
 *   - server/scripts/checkAccessories.mjs
 *
 * 新代码一律直接用 cartService，不要再往这里加东西。本文件可在
 * 前端调用点全部迁走后删除。
 */
export { listCart, addItem, addBatch, removeItem, hasOutfitInCart } from './commerce/cart.mjs'
