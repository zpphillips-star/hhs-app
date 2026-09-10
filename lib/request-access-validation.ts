export interface SanitizedRequestAccessInput {
  first_name: string
  last_name: string
  email: string
}

type ValidationResult =
  | { ok: true; data: SanitizedRequestAccessInput }
  | { ok: false; error: string }

type ValidationError = { ok: false; error: string }
type FieldValidationResult = string | ValidationError

const MAX_NAME_LENGTH = 50
const MAX_EMAIL_LENGTH = 254
const MAX_RAW_FIELD_LENGTH = 512

const CONTROL_OR_NEWLINE_RE = /[\u0000-\u001F\u007F]/
const HTML_CHARS_RE = /[<>&]/
const EMAIL_HTML_CHARS_RE = /[<>&"'`]/
const NAME_RE = /^[\p{L}\p{M}](?:[\p{L}\p{M} .'-]*[\p{L}\p{M}])?$/u
const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i

function readTrimmedField(input: unknown, label: string, maxLength: number): FieldValidationResult {
  if (typeof input !== 'string') {
    return { ok: false, error: `${label} is required.` }
  }

  if (input.length > MAX_RAW_FIELD_LENGTH) {
    return { ok: false, error: `${label} is too long.` }
  }

  const value = input.trim()
  if (!value) {
    return { ok: false, error: `${label} is required.` }
  }

  if (value.length > maxLength) {
    return { ok: false, error: `${label} is too long.` }
  }

  if (CONTROL_OR_NEWLINE_RE.test(value) || HTML_CHARS_RE.test(value)) {
    return { ok: false, error: `${label} contains unsupported characters.` }
  }

  return value
}

function validateName(value: string, label: string): ValidationError | null {
  if (!NAME_RE.test(value) || value.includes('..') || value.includes('--')) {
    return { ok: false, error: `${label} contains unsupported characters.` }
  }

  return null
}

function validateEmail(value: string): ValidationError | null {
  if (EMAIL_HTML_CHARS_RE.test(value) || /\s/.test(value)) {
    return { ok: false, error: 'Email contains unsupported characters.' }
  }

  if (!EMAIL_RE.test(value)) {
    return { ok: false, error: 'Enter a valid email address.' }
  }

  const [localPart, domain] = value.split('@')
  if (!localPart || !domain || localPart.length > 64 || domain.length > 253) {
    return { ok: false, error: 'Enter a valid email address.' }
  }

  if (value.includes('..') || domain.split('.').some((part) => !part || part.startsWith('-') || part.endsWith('-'))) {
    return { ok: false, error: 'Enter a valid email address.' }
  }

  return null
}

export function validateRequestAccessInput(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'All fields are required.' }
  }

  const record = input as Record<string, unknown>
  const firstName = readTrimmedField(record.first_name, 'First name', MAX_NAME_LENGTH)
  if (typeof firstName !== 'string') return firstName

  const lastName = readTrimmedField(record.last_name, 'Last name', MAX_NAME_LENGTH)
  if (typeof lastName !== 'string') return lastName

  const email = readTrimmedField(record.email, 'Email', MAX_EMAIL_LENGTH)
  if (typeof email !== 'string') return email

  const firstNameError = validateName(firstName, 'First name')
  if (firstNameError) return firstNameError

  const lastNameError = validateName(lastName, 'Last name')
  if (lastNameError) return lastNameError

  const normalizedEmail = email.toLowerCase()
  const emailError = validateEmail(normalizedEmail)
  if (emailError) return emailError

  return {
    ok: true,
    data: {
      first_name: firstName,
      last_name: lastName,
      email: normalizedEmail,
    },
  }
}
