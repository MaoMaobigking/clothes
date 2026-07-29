import type { Garment } from '@/data/mock'

/** 衣橱条目 = 衣物 + 是否收藏（后端返回） */
export type WardrobeItem = Garment & { fav: boolean }

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`请求失败 ${res.status}`)
  return res.json() as Promise<T>
}

export async function apiListGarments(): Promise<WardrobeItem[]> {
  const d = await json<{ items: WardrobeItem[] }>(await fetch('/api/garments'))
  return d.items
}

export async function apiAddGarment(partial: Partial<Garment>): Promise<WardrobeItem> {
  const d = await json<{ item: WardrobeItem }>(
    await fetch('/api/garments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    }),
  )
  return d.item
}

export async function apiDeleteGarment(id: string): Promise<boolean> {
  const d = await json<{ ok: boolean }>(
    await fetch(`/api/garments/${id}`, { method: 'DELETE' }),
  )
  return d.ok
}

export async function apiToggleFav(id: string): Promise<boolean> {
  const d = await json<{ fav: boolean }>(
    await fetch(`/api/garments/${id}/fav`, { method: 'POST' }),
  )
  return d.fav
}
