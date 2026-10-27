import { beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useWardrobeStore } from './wardrobe'
import { apiListGarments, type WardrobeItem } from '@/api/wardrobe'
vi.mock('@/api/wardrobe', () => ({ apiListGarments: vi.fn() }))
const api = vi.mocked(apiListGarments)
beforeEach(() => {
  setActivePinia(createPinia())
  api.mockReset()
})
it('shares concurrent reads but permits subsequent refresh', async () => {
  let finish!: (value: never[]) => void
  api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const store = useWardrobeStore()
  const first = store.load()
  const second = store.load()
  expect(api).toHaveBeenCalledTimes(1)
  finish([])
  await Promise.all([first, second])
  api.mockResolvedValueOnce([])
  await store.load()
  expect(api).toHaveBeenCalledTimes(2)
})
it('allows retry after a failed request', async () => {
  api.mockRejectedValueOnce(new Error('offline'))
  const store = useWardrobeStore()
  await store.load()
  expect(store.loadError).toContain('offline')
  api.mockResolvedValueOnce([])
  await store.load()
  expect(store.loadError).toBe('')
  expect(api).toHaveBeenCalledTimes(2)
})
it('does not apply a previous account response after reset', async () => {
  let finish!: (value: WardrobeItem[]) => void
  api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const store = useWardrobeStore()
  const old = store.load()
  store.reset()
  api.mockResolvedValueOnce([])
  await store.load()
  finish([{ id: 'previous-account' } as WardrobeItem])
  await old
  expect(store.items).toEqual([])
  expect(api).toHaveBeenCalledTimes(2)
})
