import type { VueWrapper } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { accessibleText, mountPage } from '@/__tests__/mountPage'
import { authApi } from '@/api/auth'
import { ApiError } from '@/api/errors'
import { useAuthStore } from '@/stores/auth'
import { passwordRules } from '@/utils/password'

vi.mock('@/api/auth', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    startDemo: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
  },
}))

const user = { id: 1, name: 'Ana Silva', email: 'ana@example.com', created_at: '', is_demo: false, demo_expires_at: null }
let current: VueWrapper | undefined

beforeEach(() => {
  vi.resetAllMocks()
})

afterEach(() => {
  current?.unmount()
  current = undefined
})

async function open (path: string) {
  const mounted = await mountPage(path)
  current = mounted.wrapper
  return mounted
}

async function submitForm (wrapper: VueWrapper) {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('LoginView', () => {
  it('signs in and returns to the page that required login', async () => {
    vi.mocked(authApi.login).mockResolvedValue(user)
    const { wrapper, router } = await open('/login?redirect=/documents')

    await wrapper.get('#email').setValue('  ana@example.com ')
    await wrapper.get('#password').setValue('Secret123')
    await submitForm(wrapper)

    expect(authApi.login).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'Secret123', remember: false })
    expect(useAuthStore().user).toEqual(user)
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('documents'))
  })

  it('ignores a redirect to another site', async () => {
    vi.mocked(authApi.login).mockResolvedValue(user)
    const { wrapper, router } = await open('/login?redirect=//evil.example')

    await wrapper.get('#email').setValue('ana@example.com')
    await wrapper.get('#password').setValue('Secret123')
    await submitForm(wrapper)

    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('dashboard'))
  })

  it('shows invalid credentials under the email field and stays on the page', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError('These credentials do not match our records.', 422, 'validation_failed', {
      email: ['These credentials do not match our records.'],
    }))
    const { wrapper, router } = await open('/login')

    await wrapper.get('#email').setValue('ana@example.com')
    await wrapper.get('#password').setValue('wrong')
    await submitForm(wrapper)

    expect(wrapper.text()).toContain('These credentials do not match our records.')
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('shows rate limiting and network problems as a message', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new ApiError('Too many attempts. Try again in 60 seconds.', 429, 'too_many_requests'))
    const { wrapper } = await open('/login')

    await submitForm(wrapper)

    expect(wrapper.get('[role="alert"]').text()).toContain('Too many attempts. Try again in 60 seconds.')
  })

  it('confirms a password reset and keeps the email', async () => {
    const { wrapper } = await open('/login?reset=1&email=ana%40example.com')

    expect(wrapper.text()).toContain('Your password has been reset.')
    expect((wrapper.get('#email').element as HTMLInputElement).value).toBe('ana@example.com')
  })

  it('can reveal the password', async () => {
    const { wrapper } = await open('/login')
    const input = () => wrapper.get('#password').element as HTMLInputElement

    expect(input().type).toBe('password')
    await wrapper.get('button[aria-label="Show password"]').trigger('click')
    expect(input().type).toBe('text')
  })
})

describe('RegisterView', () => {
  it('creates the account and opens the dashboard', async () => {
    vi.mocked(authApi.register).mockResolvedValue(user)
    const { wrapper, router } = await open('/register')

    await wrapper.get('#name').setValue(' Ana Silva ')
    await wrapper.get('#email').setValue('ana@example.com')
    await wrapper.get('#password').setValue('Secret123')
    await wrapper.get('#password-confirmation').setValue('Secret123')
    await submitForm(wrapper)

    expect(authApi.register).toHaveBeenCalledWith({
      name: 'Ana Silva',
      email: 'ana@example.com',
      password: 'Secret123',
      password_confirmation: 'Secret123',
    })
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('dashboard'))
  })

  it('shows validation messages per field and clears one when it is edited', async () => {
    vi.mocked(authApi.register).mockRejectedValue(new ApiError('The given data was invalid.', 422, 'validation_failed', {
      email: ['The email has already been taken.'],
      password: ['The password field confirmation does not match.'],
    }))
    const { wrapper } = await open('/register')

    await submitForm(wrapper)
    expect(wrapper.text()).toContain('The email has already been taken.')
    expect(wrapper.text()).toContain('The password field confirmation does not match.')

    await wrapper.get('#email').setValue('other@example.com')
    expect(wrapper.text()).not.toContain('The email has already been taken.')
    expect(wrapper.text()).toContain('The password field confirmation does not match.')
  })

  it('checks the password rules while typing', async () => {
    const { wrapper } = await open('/register')
    const rules = () => wrapper.get('[aria-label="Password requirements"]').findAll('li').map(li => accessibleText(li.element))

    expect(rules()).toEqual(['Min. 8 characters (not met)', 'Upper & lowercase (not met)', 'A number (not met)'])
    await wrapper.get('#password').setValue('Secret123')
    expect(rules()).toEqual(['Min. 8 characters (met)', 'Upper & lowercase (met)', 'A number (met)'])
  })
})

describe('passwordRules', () => {
  it.each([
    ['', [false, false, false]],
    ['short1A', [false, true, true]],
    ['alllowercase1', [true, false, true]],
    ['NoNumbersHere', [true, true, false]],
    ['Ünïcode-Pässwort9', [true, true, true]],
  ])('evaluates %j', (password, expected) => {
    expect(passwordRules(password).map(rule => rule.passed)).toEqual(expected)
  })
})

describe('ForgotPasswordView', () => {
  it('sends the link and shows the API message instead of the form', async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue('If an account exists for this email address, a password reset link has been sent.')
    const { wrapper } = await open('/forgot-password?email=ana%40example.com')

    expect((wrapper.get('#email').element as HTMLInputElement).value).toBe('ana@example.com')
    await submitForm(wrapper)

    expect(authApi.forgotPassword).toHaveBeenCalledWith('ana@example.com')
    expect(wrapper.get('[role="status"]').text()).toContain('If an account exists for this email address')
    expect(wrapper.find('form').exists()).toBe(false)
  })
})

describe('ResetPasswordView', () => {
  it('resets the password, then goes to login without the token in the URL', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue('Your password has been reset.')
    const { wrapper, router } = await open('/reset-password?token=abc123&email=ana%40example.com')

    await wrapper.get('#password').setValue('NewSecret123')
    await wrapper.get('#password-confirmation').setValue('NewSecret123')
    await submitForm(wrapper)

    expect(authApi.resetPassword).toHaveBeenCalledWith({
      token: 'abc123',
      email: 'ana@example.com',
      password: 'NewSecret123',
      password_confirmation: 'NewSecret123',
    })
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'))
    expect(router.currentRoute.value.query).toEqual({ reset: '1', email: 'ana@example.com' })
  })

  it('explains an expired link and offers a new one', async () => {
    vi.mocked(authApi.resetPassword).mockRejectedValue(new ApiError('This password reset token is invalid.', 422, 'validation_failed', {
      token: ['This password reset token is invalid.'],
    }))
    const { wrapper } = await open('/reset-password?token=old&email=ana%40example.com')

    await submitForm(wrapper)

    const alert = wrapper.get('[role="alert"]')
    expect(alert.text()).toContain('This password reset token is invalid.')
    expect(alert.text()).toContain('Request a new link')
  })

  it('does not show the form when the link is incomplete', async () => {
    const { wrapper } = await open('/reset-password?email=ana%40example.com')

    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('This reset link is incomplete')
  })
})

describe('Try the demo', () => {
  /** Texts of the alert boxes (form fields also contain empty role="alert" message areas). */
  function alerts (wrapper: VueWrapper) {
    return wrapper.findAll('.v-alert').map(alert => alert.text())
  }

  function demoButton (wrapper: VueWrapper) {
    return wrapper.findAll('button').find(button => accessibleText(button.element) === 'Try the demo')!
  }

  it('is offered first, above the sign-in form', async () => {
    const { wrapper } = await open('/login')

    const position = demoButton(wrapper).element.compareDocumentPosition(wrapper.get('form').element)
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('starts a demo and opens the dashboard', async () => {
    vi.mocked(authApi.startDemo).mockResolvedValue({ ...user, name: 'Demo visitor', is_demo: true, demo_expires_at: '2026-11-07T10:00:00+00:00' })
    const { wrapper, router } = await open('/login')

    await demoButton(wrapper).trigger('click')
    await flushPromises()

    expect(authApi.startDemo).toHaveBeenCalledOnce()
    expect(useAuthStore().isDemo).toBe(true)
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('dashboard'))
  })

  it('explains the hourly limit in plain words and stays on the page', async () => {
    vi.mocked(authApi.startDemo).mockRejectedValue(new ApiError('Too Many Attempts.', 429, 'too_many_requests'))
    const { wrapper, router } = await open('/login')

    await demoButton(wrapper).trigger('click')
    await flushPromises()

    expect(alerts(wrapper)).toContainEqual(expect.stringContaining('Several demos were started from your network recently'))
    expect(router.currentRoute.value.name).toBe('login')
  })

  it('shows the server message when the demo is unavailable', async () => {
    vi.mocked(authApi.startDemo).mockRejectedValue(new ApiError('The demo is not available right now. Please try again later.', 503, 'demo_unavailable'))
    const { wrapper } = await open('/login')

    await demoButton(wrapper).trigger('click')
    await flushPromises()

    expect(alerts(wrapper)).toContainEqual(expect.stringContaining('The demo is not available right now'))
  })
})
