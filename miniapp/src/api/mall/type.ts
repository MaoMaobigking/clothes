/*
 * 商城接口的数据结构（规格 §4.4 §10.6）。
 *
 * 商品来自服务端 scene_catalog，和功能四场景模拟的新品是同一份目录。
 */

export interface MallCategory {
  key: string
  label: string
  total: number
}

export interface MallProduct {
  id: string
  sceneKey: string
  category: string
  categoryLabel: string
  name: string
  price: number
  imageUrl: string
  taobaoUrl: string
  taokouling: string
  season: string
  keywords: string[]
  from: string
  to: string
  emoji: string
}

export interface MallProductList {
  categories: MallCategory[]
  items: MallProduct[]
}
