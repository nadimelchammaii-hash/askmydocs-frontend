import type { Conversation, Paginated } from '@/types/api'
import type { VueWrapper } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { accessibleText, mountPage } from '@/__tests__/mountPage'
import { authApi } from '@/api/auth'
import { conversationsApi } from '@/api/conversations'
import { ApiError } from '@/api/errors'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/api/conversations', async importOriginal => ({
  ...await importOriginal<object>(),
  conversationsApi: { list: vi.fn(), rename: vi.fn(), remove: vi.fn() },
}))
vi.mock('@/api/auth', () => ({
  authApi: { updateProfile: vi.fn(), updatePassword: vi.fn(), logout: vi.fn() },
}))

const user = { id: 1, name: 'Ana Silva', email: 'ana@example.com', created_at: '' }

const refunds: Conversation = {
  id: '01jconv000000000000000000a',
  document_id: '01jdoc0000000000000000000a',
  title: 'What is the refund policy?',
  document: { id: '01jdoc0000000000000000000a', title: 'Store Handbook' },
  messages_count: 4,
  created_at: '',
  updated_at: new Date().toISOString(),
}

function pageOf (items: Conversation[], meta: Partial<Paginated<Conversation>['meta']> = {}): Paginated<Conversation> {
  return {
    data: items,
    links: { first: '', last: '', prev: null, next: null },
    meta: { current_page: 1, last_page: 1, per_page: 20, total: items.length, from: items.length > 0 ? 1 : null, to: items.length, ...meta },
  }
}

let current: VueWrapper | undefined

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  current?.unmount()
  current = undefined
  document.body.innerHTML = ''
})

async function open (path: string) {
  const mounted = await mountPage(path, () => {
    const auth = useAuthStore()
    auth.user = { ...user }
    auth.loaded = true
  })
  current = mounted.wrapper
  await flushPromises()
  return mounted
}

/** Buttons, links and menu items anywhere in the page, including dialogs and menus. */
async function click (label: string, root: ParentNode = document.body) {
  const element = [...root.querySelectorAll<HTMLElement>('button, a, .v-list-item')]
    .find(candidate => candidate.getAttribute('aria-label') === label || accessibleText(candidate) === label)
  expect(element, `control "${label}"`).toBeDefined()
  element!.click()
  await flushPromises()
}

describe('ConversationsView', () => {
  it('lists conversations with their document, questions and links', async () => {
    vi.mocked(conversationsApi.list).mockResolvedValue(pageOf([refunds]))
    const { wrapper } = await open('/conversations')

    expect(conversationsApi.list).toHaveBeenCalledWith({ page: 1, documentId: undefined })
    const item = wrapper.get(`[data-conversation-id="${refunds.id}"]`)
    expect(item.text()).toContain('What is the refund policy?')
    expect(item.text()).toContain('Store Handbook · 2 questions · just now')
    expect(item.get('a').attributes('href')).toBe(`/conversations/${refunds.id}`)
  })

  it('filters by document from the URL and can show all again', async () => {
    vi.mocked(conversationsApi.list).mockResolvedValue(pageOf([refunds]))
    const { wrapper, router } = await open(`/conversations?document=${refunds.document_id}`)

    expect(conversationsApi.list).toHaveBeenCalledWith({ page: 1, documentId: refunds.document_id })
    expect(wrapper.text()).toContain('About Store Handbook')

    await click('Show all')
    await vi.waitFor(() => expect(router.currentRoute.value.query).toEqual({}))
    expect(conversationsApi.list).toHaveBeenLastCalledWith({ page: 1, documentId: undefined })
  })

  it('shows an empty state', async () => {
    vi.mocked(conversationsApi.list).mockResolvedValue(pageOf([]))
    const { wrapper } = await open('/conversations')

    expect(wrapper.text()).toContain('No conversations yet')
  })

  it('renames a conversation', async () => {
    vi.mocked(conversationsApi.list).mockResolvedValue(pageOf([refunds]))
    vi.mocked(conversationsApi.rename).mockResolvedValue({ ...refunds, title: 'Refunds', messages_count: undefined })
    const { wrapper } = await open('/conversations')

    await click(`More actions for ${refunds.title}`)
    await click('Rename')
    const input = document.body.querySelector<HTMLInputElement>('#rename-dialog-input')!
    expect(input.value).toBe(refunds.title)
    input.value = ' Refunds '
    input.dispatchEvent(new Event('input'))
    await click('Save')

    expect(conversationsApi.rename).toHaveBeenCalledWith(refunds.id, 'Refunds')
    const item = wrapper.get(`[data-conversation-id="${refunds.id}"]`)
    expect(item.text()).toContain('Refunds')
    // Counts from the list are kept.
    expect(item.text()).toContain('2 questions')
  })

  it('shows rename validation errors in the dialog', async () => {
    vi.mocked(conversationsApi.list).mockResolvedValue(pageOf([refunds]))
    vi.mocked(conversationsApi.rename).mockRejectedValue(new ApiError('Invalid.', 422, 'validation_failed', { title: ['The title field must not be greater than 200 characters.'] }))
    await open('/conversations')

    await click(`More actions for ${refunds.title}`)
    await click('Rename')
    await click('Save')

    expect(document.body.textContent).toContain('must not be greater than 200 characters')
  })

  it('deletes a conversation after confirmation', async () => {
    vi.mocked(conversationsApi.list)
      .mockResolvedValueOnce(pageOf([refunds]))
      .mockResolvedValueOnce(pageOf([]))
    vi.mocked(conversationsApi.remove).mockResolvedValue()
    const { wrapper } = await open('/conversations')

    await click(`More actions for ${refunds.title}`)
    await click('Delete')
    expect(document.body.textContent).toContain('The document stays in your library.')
    expect(conversationsApi.remove).not.toHaveBeenCalled()

    await click('Delete', document.body.querySelector('#confirm-dialog-title')!.closest('.v-overlay__content')!)
    expect(conversationsApi.remove).toHaveBeenCalledWith(refunds.id)
    expect(wrapper.text()).toContain('No conversations yet')
  })
})

describe('SettingsView', () => {
  it('saves only the changed profile fields', async () => {
    vi.mocked(authApi.updateProfile).mockResolvedValue({ ...user, name: 'Ana Costa' })
    const { wrapper } = await open('/settings')

    const save = () => wrapper.findAll('button').find(button => accessibleText(button.element) === 'Save profile')!
    expect((wrapper.get('#profile-name').element as HTMLInputElement).value).toBe('Ana Silva')
    expect(save().attributes('disabled')).toBeDefined()

    await wrapper.get('#profile-name').setValue(' Ana Costa ')
    expect(save().attributes('disabled')).toBeUndefined()
    wrapper.get('#profile-name').element.closest('form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(authApi.updateProfile).toHaveBeenCalledWith({ name: 'Ana Costa' })
    expect(useAuthStore().user?.name).toBe('Ana Costa')
    expect(wrapper.text()).toContain('Profile saved.')
  })

  it('shows a taken email under the field', async () => {
    vi.mocked(authApi.updateProfile).mockRejectedValue(new ApiError('Invalid.', 422, 'validation_failed', { email: ['The email has already been taken.'] }))
    const { wrapper } = await open('/settings')

    await wrapper.get('#profile-email').setValue('taken@example.com')
    wrapper.get('#profile-email').element.closest('form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(authApi.updateProfile).toHaveBeenCalledWith({ email: 'taken@example.com' })
    expect(wrapper.text()).toContain('The email has already been taken.')
  })

  it('changes the password and clears the fields', async () => {
    vi.mocked(authApi.updatePassword).mockResolvedValue()
    const { wrapper } = await open('/settings')

    await wrapper.get('#current-password').setValue('Secret123')
    await wrapper.get('#new-password').setValue('NewSecret456')
    await wrapper.get('#new-password-confirmation').setValue('NewSecret456')
    wrapper.get('#current-password').element.closest('form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(authApi.updatePassword).toHaveBeenCalledWith({
      current_password: 'Secret123',
      password: 'NewSecret456',
      password_confirmation: 'NewSecret456',
    })
    expect((wrapper.get('#current-password').element as HTMLInputElement).value).toBe('')
    expect(wrapper.text()).toContain('Password changed. Your other devices have been signed out.')
  })

  it('shows a wrong current password under its field', async () => {
    vi.mocked(authApi.updatePassword).mockRejectedValue(new ApiError('Invalid.', 422, 'validation_failed', { current_password: ['The password is incorrect.'] }))
    const { wrapper } = await open('/settings')

    await wrapper.get('#current-password').setValue('wrong')
    await wrapper.get('#new-password').setValue('NewSecret456')
    wrapper.get('#current-password').element.closest('form')!.dispatchEvent(new Event('submit'))
    await flushPromises()

    expect(wrapper.text()).toContain('The password is incorrect.')
  })

  it('signs out and goes to the login page', async () => {
    vi.mocked(authApi.logout).mockResolvedValue()
    const { wrapper, router } = await open('/settings')

    await wrapper.findAll('button').find(button => accessibleText(button.element) === 'Sign out')!.trigger('click')

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'))
    expect(authApi.logout).toHaveBeenCalledOnce()
    expect(useAuthStore().user).toBeNull()
  })
})
