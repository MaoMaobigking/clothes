import { afterEach, expect, it, vi } from 'vitest'
vi.mock('@/utils/request', () => ({ request: vi.fn(), publicRequest: vi.fn(), API_BASE_URL: '' }))
vi.mock('@/api/wardrobe', () => ({ resolveImageUrl: (value: string) => value }))
vi.mock('@/utils/performance', () => ({
  measurePerf: (_: string, run: () => unknown) => run(),
  newTraceId: () => 'test',
}))
import { request } from '@/utils/request'
import { apiGetTryon } from '../index'
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
it('keeps two historical images in separate miniapp files', async () => {
  const writes: string[] = []
  vi.stubGlobal('wx', { env: { USER_DATA_PATH: '/user' } })
  vi.stubGlobal('uni', {
    getFileSystemManager: () => ({
      writeFile: (options: any) => {
        writes.push(options.filePath)
        options.success()
      },
    }),
  })
  for (const id of ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']) {
    vi.mocked(request)
      .mockResolvedValueOnce({
        task: { taskId: id, status: 'SUCCEEDED', imageUrl: '/api/tryon/images/' + id + '.png' },
      })
      .mockResolvedValueOnce({ dataUrl: 'data:image/png;base64,aW1hZ2U=' })
    const task = await apiGetTryon(id)
    expect(task.imageUrl).toBe(writes.at(-1))
  }
  expect(new Set(writes).size).toBe(2)
  expect(vi.mocked(request).mock.calls[1][0].url).toBe('/api/tryon/images/11111111-1111-4111-8111-111111111111.png')
})
it('does not expose or preview an image when ownership check fails', async () => {
  vi.mocked(request)
    .mockResolvedValueOnce({ task: { imageUrl: '/api/tryon/images/11111111-1111-4111-8111-111111111111.png' } })
    .mockRejectedValueOnce(new Error('任务不存在'))
  await expect(apiGetTryon('someone-elses-task')).rejects.toThrow('任务不存在')
})
