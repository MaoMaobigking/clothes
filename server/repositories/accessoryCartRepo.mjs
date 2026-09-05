/**
 * 配饰购物车仓库层 —— 已弃用（规格 §4.5 §13）
 *
 * 购物车已统一到 repositories/cartRepo.mjs。本文件只做转发，
 * 保证历史 import 不断。新代码直接用 cartRepo。
 */
export { listCartRows, addCartItem, batchAddCartItems, removeCartItem, countCartGarments } from './cartRepo.mjs'
