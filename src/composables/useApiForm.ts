import { ref } from 'vue'
import { toApiError } from '@/api/errors'

/**
 * Submit state for a form that calls the API: a busy flag, validation messages
 * per field (422) and one message for everything else (rate limit, network, …).
 */
export function useApiForm () {
  const submitting = ref(false)
  const fieldErrors = ref<Record<string, string[]>>({})
  const formError = ref<string | null>(null)

  /** Runs the request. Resolves with its result, or `undefined` when it failed (errors are then set). */
  async function submit<T> (request: () => Promise<T>): Promise<T | undefined> {
    if (submitting.value) {
      return undefined
    }
    submitting.value = true
    fieldErrors.value = {}
    formError.value = null
    try {
      return await request()
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.status === 422 && Object.keys(apiError.errors).length > 0) {
        fieldErrors.value = apiError.errors
      } else {
        formError.value = apiError.message
      }
      return undefined
    } finally {
      submitting.value = false
    }
  }

  /** Hides a field's message once the user edits it. */
  function clearFieldError (field: string) {
    if (fieldErrors.value[field]) {
      const { [field]: _removed, ...rest } = fieldErrors.value
      fieldErrors.value = rest
    }
  }

  return { submitting, fieldErrors, formError, submit, clearFieldError }
}
