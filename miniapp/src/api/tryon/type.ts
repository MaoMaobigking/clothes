/*
 * AI 试衣（阿里百炼 aitryon）的数据结构。
 */

export type AiTaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED' | 'UNKNOWN'

export interface AiTask {
  id: number
  capability: string
  provider: string
  model: string
  taskId: string
  status: AiTaskStatus
  input: Record<string, any>
  imageUrl: string
  errorMessage: string
  createdAt: string
}

export interface TryonPayload {
  personImageUrl: string
  topGarmentUrl?: string
  bottomGarmentUrl?: string
  model?: string
}
