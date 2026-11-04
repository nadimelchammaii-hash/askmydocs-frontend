import type { Document, DocumentStatus, Paginated } from '@/types/api'
import type { LocationQuery } from 'vue-router'
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { documentsApi } from '@/api/documents'
import { type ApiError, toApiError } from '@/api/errors'
import { usePolling } from './usePolling'

/** Status filters offered by the library (the API filters on one status at a time). */
export const LIBRARY_STATUS_FILTERS = ['ready', 'failed'] as const satisfies readonly DocumentStatus[]
export type LibraryStatusFilter = typeof LIBRARY_STATUS_FILTERS[number]

/** The API rejects longer searches (422). */
export const MAX_SEARCH_LENGTH = 100

export interface LibraryFilters {
  page: number
  status?: LibraryStatusFilter
  search?: string
}

function single (value: LocationQuery[string]): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** Reads the filters from the URL, ignoring anything malformed (the URL can be edited by hand). */
export function filtersFromQuery (query: LocationQuery): LibraryFilters {
  const page = Number(single(query.page))
  const status = single(query.status)
  const search = single(query.search)?.trim().slice(0, MAX_SEARCH_LENGTH)
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    status: LIBRARY_STATUS_FILTERS.find(filter => filter === status),
    search: search || undefined,
  }
}

/**
 * The document list of the library page. The URL is the source of truth for the
 * filters (?search=&status=&page=), so they survive reloads and the top-bar search works.
 * Documents that are still being processed are refreshed until they are finished.
 */
export function useDocumentLibrary () {
  const route = useRoute()
  const router = useRouter()

  const filters = computed(() => filtersFromQuery(route.query))
  const hasFilters = computed(() => filters.value.status !== undefined || filters.value.search !== undefined)

  const documents = ref<Document[]>([])
  const meta = shallowRef<Paginated<Document>['meta'] | null>(null)
  const loading = ref(false)
  const error = shallowRef<ApiError | null>(null)

  /** Changes filters in the URL (replace: filtering is not worth a history entry). */
  function setFilters (changes: Partial<LibraryFilters>) {
    const next = { ...filters.value, ...changes }
    const query: LocationQuery = { ...route.query }
    delete query.page
    delete query.status
    delete query.search
    if (next.page > 1) {
      query.page = String(next.page)
    }
    if (next.status) {
      query.status = next.status
    }
    if (next.search) {
      query.search = next.search
    }
    return router.replace({ query })
  }

  function clearFilters () {
    return setFilters({ page: 1, status: undefined, search: undefined })
  }

  let latestRequest = 0

  async function load () {
    const request = ++latestRequest
    loading.value = true
    error.value = null
    try {
      const result = await documentsApi.list(filters.value)
      if (request !== latestRequest) {
        return
      }
      // A page beyond the end (e.g. after deleting the last item of the last page): show the last one.
      if (result.data.length === 0 && result.meta.current_page > result.meta.last_page && result.meta.last_page >= 1) {
        await setFilters({ page: result.meta.last_page })
        return
      }
      documents.value = result.data
      meta.value = result.meta
    } catch (error_) {
      if (request === latestRequest) {
        error.value = toApiError(error_)
      }
    } finally {
      if (request === latestRequest) {
        loading.value = false
      }
    }
  }

  // Reload when a filter changes (not when other query parameters such as ?upload change).
  watch(() => JSON.stringify(filters.value), load, { immediate: true })

  /** Puts the latest version of a document in the list (rename, retry, polling). */
  function replace (updated: Document) {
    const index = documents.value.findIndex(document => document.id === updated.id)
    if (index !== -1) {
      documents.value[index] = updated
    }
  }

  function removeLocally (id: string) {
    documents.value = documents.value.filter(document => document.id !== id)
  }

  // --- Processing updates -------------------------------------------------
  const unfinishedIds = computed(() => documents.value.filter(document => !document.is_finished).map(document => document.id))

  const processing = usePolling(async signal => {
    const ids = unfinishedIds.value
    const results = await Promise.all(ids.map(async id => {
      try {
        return await documentsApi.get(id, signal)
      } catch (error_) {
        const apiError = toApiError(error_)
        // Deleted meanwhile (e.g. in another tab): drop it instead of stopping all updates.
        if (apiError.status === 404) {
          removeLocally(id)
          return null
        }
        throw apiError
      }
    }))
    for (const document of results) {
      if (document) {
        replace(document)
      }
    }
    return results
  }, { immediate: false, until: () => unfinishedIds.value.length === 0 })

  watch(() => unfinishedIds.value.join(','), ids => {
    if (ids !== '' && !processing.isPolling.value) {
      processing.start()
    }
  })

  /** Shows a newly uploaded document: first on page 1 without filters. */
  async function showUploaded (document: Document) {
    if (filters.value.page === 1 && !hasFilters.value) {
      documents.value = [document, ...documents.value].slice(0, meta.value?.per_page ?? 20)
      if (meta.value) {
        meta.value = { ...meta.value, total: meta.value.total + 1 }
      }
    } else {
      await clearFilters()
    }
    // Check its progress right away (a running poll may be in a long back-off).
    processing.start()
  }

  /** After retry: the document is queued again. */
  function showRequeued (document: Document) {
    replace(document)
    processing.start()
  }

  return {
    filters,
    hasFilters,
    documents,
    meta,
    loading,
    error,
    load,
    setFilters,
    clearFilters,
    replace,
    showUploaded,
    showRequeued,
  }
}
