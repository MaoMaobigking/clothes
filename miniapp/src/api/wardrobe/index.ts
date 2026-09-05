/*
 * 衣橱与搭配接口（功能一 / 功能二）。
 */
import type { Garment } from '@/types'
import { API_BASE_URL, request, uploadFile } from '@/utils/request'
import { USE_CLOUD, cloudUploadImage } from '@/utils/cloud'
import type { Outfit, OutfitBatch, WardrobeItem } from './type'

enum API {
  /** 衣物列表 / 新增 */
  GARMENTS_URL = '/api/garments',
  /** 单件衣物，后面接 id（PATCH 改 / DELETE 删） */
  GARMENT_URL = '/api/garments/',
  /** 拖拽排序 */
  GARMENTS_REORDER_URL = '/api/garments/reorder',
  /** multipart 上传 */
  WARDROBE_UPLOAD_URL = '/api/wardrobe/upload',
  /** 云开发链路：传云存储后交给后端下载落盘 */
  WARDROBE_UPLOAD_REMOTE_URL = '/api/wardrobe/upload-remote',
  /** 生成搭配 */
  WARDROBE_GENERATE_URL = '/api/wardrobe/generate',
  /** 按批次回看，后面接 batchId */
  WARDROBE_BATCH_URL = '/api/wardrobe/batch/',
  /** 搭配列表 / 手动创建 */
  OUTFITS_URL = '/api/wardrobe/outfits',
  /** 单条搭配，后面接 id 再拼 /star、/save、/replace */
  OUTFIT_URL = '/api/wardrobe/outfits/',
}

/** 类型再导出的理由见 api/diary/index.ts 的说明 */
export type { Outfit, OutfitBatch, OutfitItem, WardrobeItem } from './type'

export function resolveImageUrl(src?: string) {
  if (!src || /^(https?:|data:|blob:)/i.test(src)) return src
  if (src.startsWith('/uploads/')) return `${API_BASE_URL}${src}`
  return src
}

function normalizeGarment(item: WardrobeItem): WardrobeItem {
  return {
    ...item,
    img: resolveImageUrl(item.img) || '',
    primaryColor: item.primaryColor || '',
    secondaryColors: item.secondaryColors || [],
    seasons: item.seasons?.length ? item.seasons : item.season ? [item.season] : [],
    occasions: item.occasions || [],
    frequentlyWorn: Boolean(item.frequentlyWorn),
    sortOrder: Number(item.sortOrder ?? 0),
  }
}

export async function apiListGarments(): Promise<WardrobeItem[]> {
  const d = await request<{ items: WardrobeItem[] }>({ url: API.GARMENTS_URL })
  return d.items.map(normalizeGarment)
}

export async function apiAddGarment(partial: Partial<Garment>): Promise<WardrobeItem> {
  const d = await request<{ item: WardrobeItem }>({
    url: API.GARMENTS_URL,
    method: 'POST',
    data: partial,
  })
  return normalizeGarment(d.item)
}

export async function apiDeleteGarment(id: string): Promise<boolean> {
  const d = await request<{ ok: boolean }>({
    url: API.GARMENT_URL + id,
    method: 'DELETE',
  })
  return d.ok
}

export async function apiToggleFav(id: string): Promise<boolean> {
  const d = await request<{ fav: boolean }>({
    url: `${API.GARMENT_URL}${id}/fav`,
    method: 'POST',
  })
  return d.fav
}

export async function apiUpdateGarment(id: string, partial: Partial<Garment>): Promise<WardrobeItem> {
  const d = await request<{ item: WardrobeItem }>({
    url: API.GARMENT_URL + id,
    method: 'PATCH',
    data: partial,
  })
  return normalizeGarment(d.item)
}

export async function apiReorderGarments(ids: string[]): Promise<WardrobeItem[]> {
  const d = await request<{ items: WardrobeItem[] }>({
    url: API.GARMENTS_REORDER_URL,
    method: 'PUT',
    data: { ids },
  })
  return d.items.map(normalizeGarment)
}

export async function apiToggleFrequentlyWorn(id: string): Promise<WardrobeItem> {
  const d = await request<{ item: WardrobeItem }>({
    url: `${API.GARMENT_URL}${id}/frequently-worn`,
    method: 'POST',
  })
  return normalizeGarment(d.item)
}

export async function apiUploadGarments(filePaths: string[]): Promise<WardrobeItem[]> {
  const items: WardrobeItem[] = []

  /*
   * 云开发模式：wx.uploadFile 和 request 受同一套域名校验，传不到裸 IP。
   * 改成「传云存储 → 换 https → 交给后端下载落盘」，落盘后与 multipart
   * 那条路产出完全一致（见 server/routes/wardrobe.mjs 的 /upload-remote）。
   */
  if (USE_CLOUD) {
    const urls: string[] = []
    const fileIDs: string[] = []
    for (const filePath of filePaths) {
      const up = await cloudUploadImage(filePath, 'garments')
      urls.push(up.url)
      // fileID 一起传：后端拿 url 下载留底，拿 fileID 落库当显示地址
      fileIDs.push(up.fileID)
    }
    const d = await request<{ items?: WardrobeItem[] }>({
      url: API.WARDROBE_UPLOAD_REMOTE_URL,
      method: 'POST',
      data: { urls, fileIDs },
    })
    return (d.items || []).map(normalizeGarment)
  }

  for (const filePath of filePaths) {
    const d = await uploadFile<{ item?: WardrobeItem; items?: WardrobeItem[] }>({
      url: API.WARDROBE_UPLOAD_URL,
      filePath,
      name: 'files',
    })
    if (d.item) items.push(normalizeGarment(d.item))
    if (Array.isArray(d.items)) items.push(...d.items.map(normalizeGarment))
  }
  return items
}

function normalizeOutfit(outfit: Outfit): Outfit {
  return {
    ...outfit,
    // 老后端不返回 isStarred，这里兜一个 false，免得模板里 undefined 当真值用
    isStarred: Boolean(outfit.isStarred),
    items: outfit.items.map((item) => ({
      ...item,
      garment: normalizeGarment(item.garment),
    })),
  }
}

export async function apiGenerateOutfits(selectedIds: string[] = []): Promise<OutfitBatch> {
  const d = await request<{ batch: OutfitBatch }>({
    url: API.WARDROBE_GENERATE_URL,
    method: 'POST',
    data: { selectedIds },
  })
  return {
    ...d.batch,
    outfits: d.batch.outfits.map(normalizeOutfit),
  }
}

export async function apiGetOutfitBatch(batchId: string): Promise<OutfitBatch> {
  const d = await request<{ batch: OutfitBatch }>({
    url: API.WARDROBE_BATCH_URL + batchId,
  })
  return {
    ...d.batch,
    outfits: d.batch.outfits.map(normalizeOutfit),
  }
}

export async function apiListOutfits(
  saved = false,
  opts: { starred?: boolean; kind?: 'manual' | 'generated' } = {},
): Promise<Outfit[]> {
  const q = [`saved=${saved ? 1 : 0}`]
  if (opts.starred) q.push('starred=1')
  if (opts.kind) q.push(`kind=${opts.kind}`)
  const d = await request<{ items: Outfit[] }>({
    url: `${API.OUTFITS_URL}?${q.join('&')}`,
  })
  return d.items.map(normalizeOutfit)
}

/**
 * 自由搭配页的「保存」：手动挑的一组衣物落成一条 kind='manual' 的搭配。
 * 注意它不产生 batchId —— 回看时要走 outfitId，不能拼 /outfit-result?batchId=。
 *
 * garmentIds 是字符串 id（`g1`），原样传，别转数字：garments.id 是 VARCHAR。
 */
export async function apiCreateOutfit(payload: {
  garmentIds: string[]
  title?: string
  scene?: string
  reason?: string
}): Promise<Outfit> {
  const d = await request<{ item: Outfit }>({
    url: API.OUTFITS_URL,
    method: 'POST',
    data: { ...payload, garmentIds: payload.garmentIds.map(String) },
  })
  return normalizeOutfit(d.item)
}

/** 「收藏」= 星标。后端会顺带把 is_saved 置 1，所以未保存直接点收藏也是通的 */
export async function apiStarOutfit(id: number, starred = true): Promise<Outfit> {
  const d = await request<{ item: Outfit }>({
    url: `${API.OUTFIT_URL}${id}/star`,
    method: 'POST',
    data: { starred },
  })
  return normalizeOutfit(d.item)
}

export async function apiSaveOutfit(id: number): Promise<Outfit> {
  const d = await request<{ item: Outfit }>({
    url: `${API.OUTFIT_URL}${id}/save`,
    method: 'POST',
  })
  return normalizeOutfit(d.item)
}

export async function apiReplaceOutfitItem(
  outfitId: number,
  oldGarmentId: string,
  newGarmentId: string,
): Promise<Outfit> {
  const d = await request<{ item: Outfit }>({
    url: `${API.OUTFIT_URL}${outfitId}/replace`,
    method: 'POST',
    data: { oldGarmentId, newGarmentId },
  })
  return normalizeOutfit(d.item)
}

/**
 * 整套搭配加入购物车 —— 已移到 api/cart 的 addOutfitToCart()。
 * 购物车统一后（规格 §4.5 §13）请用 stores/cart.ts 的 addOutfit()，
 * 它会把返回的整车同步进 store，徽标和购物车页才对得上。
 */
