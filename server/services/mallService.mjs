/**
 * 商城业务层（规格 §4.4 §10.6）
 *
 * 商城不另起商品表，直接复用功能四的 scene_catalog。
 * 场景模拟的「新旧混搭」本来就从这张目录选品，再开一份 mall_products
 * 只会让同一件衣服在两个页面价格、淘口令对不上，购物车更没法统一 ——
 * cart_items 里 item_type='catalog' 指的就是这张表的 id。
 * 所以「商城」= 按品类重排的场景目录，同一份数据换个逛法。
 *
 * 品类中文名放服务端：目录里存的是 top/bag 这种 key，
 * 前端不该各自维护一份翻译，否则加一个品类要改两处。
 */
import { findCatalogById, listCatalogCategories, listCatalogProducts } from '../repositories/sceneRepo.mjs'

const CATEGORY_LABELS = {
  top: '上衣',
  dress: '连衣裙',
  pants: '裤装',
  skirt: '半裙',
  shoes: '鞋履',
  bag: '包袋',
  hat: '帽饰',
  jewelry: '首饰',
  accessory: '配饰',
}

/** 逛街顺序：先看衣服再看鞋包配饰，和线下动线一致 */
const CATEGORY_ORDER = ['top', 'dress', 'pants', 'skirt', 'shoes', 'bag', 'hat', 'jewelry', 'accessory']

export function categoryLabel(key) {
  return CATEGORY_LABELS[key] || key
}

function sortCategories(categories) {
  return [...categories].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.key)
    const bi = CATEGORY_ORDER.indexOf(b.key)
    // 没登记的新品类排在最后，但不丢
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
  })
}

/**
 * 商城列表。
 * category 传空就是全部；categories 始终返回全量，
 * 否则筛完一次分类栏就只剩当前那一项，人退不回去。
 */
export async function listProducts({ category, sceneKey } = {}) {
  const [items, rawCategories] = await Promise.all([
    listCatalogProducts({ category, sceneKey }),
    listCatalogCategories(),
  ])
  const categories = sortCategories(rawCategories).map((entry) => ({
    ...entry,
    label: categoryLabel(entry.key),
  }))
  return {
    categories,
    items: items.map((item) => ({ ...item, categoryLabel: categoryLabel(item.category) })),
  }
}

export async function getProduct(id) {
  const item = await findCatalogById(id)
  if (!item) return null
  return { ...item, categoryLabel: categoryLabel(item.category) }
}
