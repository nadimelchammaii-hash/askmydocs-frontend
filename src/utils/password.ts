/**
 * The password rules enforced by the API (Password::defaults() in the backend):
 * at least 8 characters, upper- and lowercase letters, and a number.
 * Shown live while typing; the server validates again.
 */
export interface PasswordRule {
  label: string
  passed: boolean
}

export function passwordRules (password: string): PasswordRule[] {
  return [
    { label: 'Min. 8 characters', passed: password.length >= 8 },
    { label: 'Upper & lowercase', passed: /\p{Lu}/u.test(password) && /\p{Ll}/u.test(password) },
    { label: 'A number', passed: /\d/.test(password) },
  ]
}
