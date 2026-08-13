import type { Garment } from '@/data/mock'
import { API_BASE_URL, request, uploadFile } from './http'

export type WardrobeItem = Garment & { fav: boolean }

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
  const d = await request<{ items: WardrobeItem[] }>({ url: '/api/garments' })
  return d.items.map(normalizeGarment)
}

export async function apiAddGarment(partial: Partial<Garment>): Promise<WardrobeItem> {
  const d = await request<{ item: WardrobeItem }>({
    url: '/api/garments',
    method: 'POST',
    data: partial,
  })
  return normalizeGarment(d.item)
}

export async function apiDeleteGarment(id: string): Promise<boolean> {
  const d = await request<{ ok: boolean }>({
    url: `/api/garments/${id}`,
    method: 'DELETE',
  })
  return d.ok
}

export async function apiToggleFav(id: string): Promise<boolean> {
  const d = await request<{ fav: boolean }>({
    url: `/api/garments/${id}/fav`,
    method: 'POST',
  })
  return d.fav
}

export async function apiUpdateGarment(
  id: string,
  partial: Partial<Garment>,
): Promise<WardrobeItem> {
  const d = await request<{ item: WardrobeItem }>({
    url: `/api/garments/${id}`,
    method: 'PATCH',
    data: partial,
  })
  return normalizeGarment(d.item)
}

export async function apiReorderGarments(ids: string[]): Promise<WardrobeItem[]> {
  const d = await request<{ items: WardrobeItem[] }>({
    url: '/api/garments/reorder',
    method: 'PUT',
    data: { ids },
  })
  return d.items.map(normalizeGarment)
}

export async function apiToggleFrequentlyWorn(id: string): Promise<WardrobeItem> {
  const d = await request<{ item: WardrobeItem }>({
    url: `/api/garments/${id}/frequently-worn`,
    method: 'POST',
  })
  return normalizeGarment(d.item)
}

export async function apiUploadGarments(filePaths: string[]): Promise<WardrobeItem[]> {
  const items: WardrobeItem[] = []
  for (const filePath of filePaths) {
    const d = await uploadFile<{ item?: WardrobeItem; items?: WardrobeItem[] }>({
      url: '/api/wardrobe/upload',
      filePath,
      name: 'files',
    })
    if (d.item) items.push(normalizeGarment(d.item))
    if (Array.isArray(d.items)) items.push(...d.items.map(normalizeGarment))
  }
  return items
}

export interface OutfitItem {
  id: number
  sortOrder: number
  garment: WardrobeItem
}

export interface Outfit {
  id: number
  title: string
  scene: string
  reason: string
  batchId: string
  kind: string
  isSaved: boolean
  season: string
  occasion: string
  algorithm: Record<string, any>
  items: OutfitItem[]
  createdAt: string
}

export interface OutfitBatch {
  id: string
  outfits: Outfit[]
}

function normalizeOutfit(outfit: Outfit): Outfit {
  return {
    ...outfit,
    items: outfit.items.map((item) => ({
      ...item,
      garment: normalizeGarment(item.garment),
    })),
  }
}

export async function apiGenerateOutfits(selectedIds: string[] = []): Promise<OutfitBatch> {
  const d = await request<{ batch: OutfitBatch }>({
    url: '/api/wardrobe/generate',
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
    url: `/api/wardrobe/batch/${batchId}`,
  })
  return {
    ...d.batch,
    outfits: d.batch.outfits.map(normalizeOutfit),
  }
}

export async function apiListOutfits(saved = false): Promise<Outfit[]> {
  const d = await request<{ items: Outfit[] }>({
    url: `/api/wardrobe/outfits?saved=${saved ? 1 : 0}`,
  })
  return d.items.map(normalizeOutfit)
}

export async function apiSaveOutfit(id: number): Promise<Outfit> {
  const d = await request<{ item: Outfit }>({
    url: `/api/wardrobe/outfits/${id}/save`,
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
    url: `/api/wardrobe/outfits/${outfitId}/replace`,
    method: 'POST',
    data: { oldGarmentId, newGarmentId },
  })
  return normalizeOutfit(d.item)
}

export async function apiAddOutfitToCart(outfitId: number): Promise<number> {
  const d = await request<{ items: Array<{ quantity: number }> }>({
    url: `/api/cart/outfits/${outfitId}`,
    method: 'POST',
  })
  return d.items.reduce((sum, item) => sum + item.quantity, 0)
}
