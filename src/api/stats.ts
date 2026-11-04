import type { Resource, Stats } from '@/types/api'
import { http } from './http'

export const statsApi = {
  /** Dashboard numbers: documents by status, indexed pages, conversations, questions asked today. */
  async get (signal?: AbortSignal): Promise<Stats> {
    const { data } = await http.get<Resource<Stats>>('/api/v1/stats', { signal })
    return data.data
  },
}
