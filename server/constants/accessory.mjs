/**
 * 配饰领域的固定配置表。
 *
 * 从 services/wardrobe/accessory.mjs 迁出（第 4 条规矩：数据与逻辑分离）。
 * 这些是「规则推荐」用到的查表数据，改一条分类标签或预算档位不该去翻推荐算法。
 * 算法本身（色彩调和、评分、预算/体型修正）留在 service 层。
 */
export const ACCESSORY_CATEGORIES = [
  { key: 'jewelry', label: '首饰' },
  { key: 'hat', label: '帽子' },
  { key: 'scarf', label: '围巾' },
  { key: 'belt', label: '腰带' },
  { key: 'shoes', label: '鞋子' },
]

export const CATEGORY_LABELS = Object.fromEntries(
  ACCESSORY_CATEGORIES.map((category) => [category.key, category.label]),
)

export const GARMENT_CATEGORY_LABELS = {
  top: '上衣',
  pants: '下装',
  skirt: '下装',
  dress: '连衣裙',
  shoes: '鞋履',
  bag: '包袋',
  hat: '帽子',
  jewelry: '首饰',
  accessory: '配饰',
}

export const BUDGET_RANGES = {
  low: [0, 119],
  mid: [120, 329],
  high: [330, 9999],
}

export const DEMO_RATINGS = [
  [
    'accessory_demo_lingxi_1',
    '珍珠耳钉',
    [
      ['ac-jewelry-1', 5],
      ['ac-shoes-1', 5],
      ['ac-scarf-1', 4],
    ],
  ],
  [
    'accessory_demo_lingxi_2',
    '法式试装',
    [
      ['ac-jewelry-2', 4],
      ['ac-hat-2', 5],
      ['ac-shoes-2', 5],
    ],
  ],
  [
    'accessory_demo_lingxi_3',
    '通勤穿搭',
    [
      ['ac-belt-1', 5],
      ['ac-shoes-4', 5],
      ['ac-scarf-3', 4],
    ],
  ],
  [
    'accessory_demo_lingxi_4',
    '街头造型',
    [
      ['ac-hat-3', 5],
      ['ac-shoes-1', 4],
      ['ac-jewelry-3', 4],
    ],
  ],
  [
    'accessory_demo_lingxi_5',
    '约会灵感',
    [
      ['ac-jewelry-4', 5],
      ['ac-shoes-2', 5],
      ['ac-scarf-2', 4],
    ],
  ],
]
