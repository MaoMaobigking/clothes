import type { Garment } from '@/data/mock'

/** 衣橱条目 = 衣物 + 是否收藏（后端返回） */
export type WardrobeItem = Garment & { fav: boolean }

async function json<T>(res: any): Promise<T> {
  // uni-app 的 uni.request 返回结构不同
  const data = res.data || res
  if (res.statusCode && res.statusCode >= 400) throw new Error(`请求失败 ${res.statusCode}`)
  return data as T
}

function request<T>(options: { url: string; method?: string; data?: any }): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: options.url,
      method: (options.method || 'GET') as any,
      data: options.data,
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        if (res.statusCode >= 400) reject(new Error(`请求失败 ${res.statusCode}`))
        else resolve(res.data as T)
      },
      fail: (err) => reject(err),
    })
  })
}

export async function apiListGarments(): Promise<WardrobeItem[]> {
  const d = await request<{ items: WardrobeItem[] }>({ url: '/api/garments' })
  return d.items
}

export async function apiAddGarment(partial: Partial<Garment>): Promise<WardrobeItem> {
  const d = await request<{ item: WardrobeItem }>({
    url: '/api/garments',
    method: 'POST',
    data: partial,
  })
  return d.item
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
