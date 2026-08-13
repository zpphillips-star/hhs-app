import { createHmac, timingSafeEqual } from 'crypto'

const APPROVAL_LINK_TTL_MS = 48 * 60 * 60 * 1000
const TOKEN_VERSION = 'hhs-approval-v1'

type ApprovalTokenPayload = {
  v: typeof TOKEN_VERSION
  requestId: string
  userId: string
  email: string
  exp: number
}

export type VerifiedApprovalToken =
  | { ok: true; requestId: string; userId: string; email: string; expiresAt: Date }
  | { ok: false; reason: 'missing' | 'malformed' | 'expired' | 'invalid' }

function getSigningSecret() {
  const secret = process.env.HHS_APPROVAL_LINK_SECRET ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error('Approval link signing secret is not configured.')
  }
  return secret
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signPayload(encodedPayload: string) {
  return createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url')
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)
  if (aBuffer.length !== bBuffer.length) return false
  return timingSafeEqual(aBuffer, bBuffer)
}

export function createApprovalSetupToken({
  requestId,
  userId,
  email,
  now = Date.now(),
}: {
  requestId: string
  userId: string
  email: string
  now?: number
}) {
  const payload: ApprovalTokenPayload = {
    v: TOKEN_VERSION,
    requestId,
    userId,
    email: email.trim().toLowerCase(),
    exp: now + APPROVAL_LINK_TTL_MS,
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  return `${encodedPayload}.${signPayload(encodedPayload)}`
}

export function verifyApprovalSetupToken(token: string | null | undefined): VerifiedApprovalToken {
  if (!token) return { ok: false, reason: 'missing' }

  const [encodedPayload, signature, ...extra] = token.split('.')
  if (!encodedPayload || !signature || extra.length) return { ok: false, reason: 'malformed' }

  const expectedSignature = signPayload(encodedPayload)
  if (!safeEqual(signature, expectedSignature)) return { ok: false, reason: 'invalid' }

  let payload: ApprovalTokenPayload
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as ApprovalTokenPayload
  } catch {
    return { ok: false, reason: 'malformed' }
  }

  if (
    payload.v !== TOKEN_VERSION ||
    !payload.requestId ||
    !payload.userId ||
    !payload.email ||
    typeof payload.exp !== 'number'
  ) {
    return { ok: false, reason: 'malformed' }
  }

  if (Date.now() > payload.exp) return { ok: false, reason: 'expired' }

  return {
    ok: true,
    requestId: payload.requestId,
    userId: payload.userId,
    email: payload.email.trim().toLowerCase(),
    expiresAt: new Date(payload.exp),
  }
}

