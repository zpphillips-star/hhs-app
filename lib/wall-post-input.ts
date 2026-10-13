const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const INT_MAX = 2147483647
const MEDIA_FIELDS = new Set([
  'media_url', 'media_type', 'mime_type', 'storage_bucket', 'storage_path',
  'width', 'height', 'duration_ms', 'thumbnail_url', 'sort_order',
  'size_bytes', 'media_size_bytes',
])

export class WallPostInputError extends Error {}

function invalid(message: string): never {
  throw new WallPostInputError(message)
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalid(`${field} must be an object`)
  }
  return value as Record<string, unknown>
}

function text(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') invalid(`${field} must be a string or null`)
  return value.trim() || null
}

function uuid(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null
  const result = text(value, field)
  if (!result || !UUID.test(result)) invalid(`${field} must be a UUID`)
  return result.toLowerCase()
}

function url(value: unknown, field: string): string | null {
  const result = text(value, field)
  if (!result) return null
  let parsed: URL
  try {
    parsed = new URL(result)
  } catch {
    return invalid(`${field} must be an absolute HTTP(S) URL`)
  }
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    invalid(`${field} must be an absolute HTTP(S) URL without credentials`)
  }
  return result
}

function integer(value: unknown, field: string, min: number, max = INT_MAX): number | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    invalid(`${field} must be an integer between ${min} and ${max}`)
  }
  return value
}

function mediaType(value: unknown): 'image' | 'video' | 'gif' | null {
  if (value === undefined || value === null) return null
  if (value !== 'image' && value !== 'video' && value !== 'gif') {
    invalid('media_type must be image, video, or gif')
  }
  return value
}

// Match production main's top-level legacy normalization. Do not relax the
// explicit attachment schema: media[].media_type still uses mediaType above.
function legacyMediaType(value: unknown, mediaUrl: string | null): 'image' | 'video' | null {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized.startsWith('video')) return 'video'
    if (normalized.startsWith('image')) return 'image'
  }
  if (mediaUrl && /\.(mp4|mov|m4v|webm|3gp|3gpp)(?:$|[?#])/i.test(mediaUrl)) return 'video'
  return mediaUrl ? 'image' : null
}

function attachment(value: unknown, index: number) {
  const item = record(value, `media[${index}]`)
  for (const key of Object.keys(item)) {
    if (!MEDIA_FIELDS.has(key)) invalid(`Unknown media field: ${key}`)
  }
  const mediaUrl = url(item.media_url, 'media_url')
  if (!mediaUrl) invalid('Each media attachment requires media_url')
  const mimeType = text(item.mime_type, 'mime_type')
  if (mimeType && !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(mimeType)) {
    invalid('mime_type must be a MIME type')
  }
  const size = integer(item.size_bytes, 'size_bytes', 0, Number.MAX_SAFE_INTEGER)
  const legacySize = integer(item.media_size_bytes, 'media_size_bytes', 0, Number.MAX_SAFE_INTEGER)
  if (size !== null && legacySize !== null && size !== legacySize) {
    invalid('size_bytes and media_size_bytes must match')
  }
  return {
    media_url: mediaUrl,
    media_type: mediaType(item.media_type),
    mime_type: mimeType,
    storage_bucket: text(item.storage_bucket, 'storage_bucket'),
    storage_path: text(item.storage_path, 'storage_path'),
    width: integer(item.width, 'width', 1),
    height: integer(item.height, 'height', 1),
    duration_ms: integer(item.duration_ms, 'duration_ms', 0),
    thumbnail_url: url(item.thumbnail_url, 'thumbnail_url'),
    size_bytes: size ?? legacySize,
    sort_order: integer(item.sort_order, 'sort_order', 0, 5) ?? index,
  }
}

export function parseWallPostInput(value: unknown, idempotencyKey: string | null) {
  const body = record(value, 'Body')
  const userId = uuid(body.user_id, 'user_id')
  const beerId = body.beer_id === '' ? null : uuid(body.beer_id, 'beer_id')
  const content = text(body.content, 'content') ?? ''
  if (content.length > 2000) invalid('Post content must be 2000 characters or fewer')
  const requestId = uuid(body.request_id, 'request_id')
  const headerId = uuid(idempotencyKey, 'Idempotency-Key')
  if (requestId && headerId && requestId !== headerId) {
    invalid('request_id and Idempotency-Key must match')
  }

  // Validate legacy fields even when the explicit array takes precedence.
  const mediaUrl = url(body.media_url, 'media_url')
  const photoUrl = url(body.photo_url, 'photo_url')
  const imageUrl = url(body.image_url, 'image_url')
  const fallbackUrl = mediaUrl ?? photoUrl ?? imageUrl
  const type = legacyMediaType(body.media_type, fallbackUrl)
  const thumbnail = url(body.thumbnail_url, 'thumbnail_url')
  const size = integer(body.media_size_bytes, 'media_size_bytes', 0, Number.MAX_SAFE_INTEGER)
  const duration = integer(body.video_duration_ms, 'video_duration_ms', 0)
  let media: ReturnType<typeof attachment>[]
  if (Object.hasOwn(body, 'media')) {
    if (!Array.isArray(body.media)) invalid('media must be an array')
    if (body.media.length > 6) invalid('Posts support up to 6 media attachments')
    media = body.media.map(attachment)
  } else {
    media = fallbackUrl ? [attachment({
      media_url: fallbackUrl,
      media_type: type,
      thumbnail_url: thumbnail,
      size_bytes: size,
      duration_ms: duration,
    }, 0)] : []
  }

  const slots = new Set<number>()
  const urls = new Set<string>()
  const paths = new Set<string>()
  for (const item of media) {
    // Native 152 sends some metadata only at the top level alongside media[].
    if (item.media_url === fallbackUrl) {
      item.media_type ??= type
      item.thumbnail_url ??= thumbnail
      item.size_bytes ??= size
      item.duration_ms ??= duration
    }
    item.media_type ??= item.mime_type?.toLowerCase() === 'image/gif' || /\.gif(?:$|[?#])/i.test(item.media_url)
      ? 'gif'
      : item.mime_type?.toLowerCase().startsWith('video/') || /\.(mp4|mov|m4v|webm|3gp|3gpp)(?:$|[?#])/i.test(item.media_url)
        ? 'video' : 'image'
    const parsedUrl = new URL(item.media_url)
    const urlKey = `${parsedUrl.origin}${parsedUrl.pathname}`
    const pathKey = item.storage_path === null
      ? null : JSON.stringify([item.storage_bucket ?? 'post-photos', item.storage_path])
    if (slots.has(item.sort_order) || urls.has(urlKey) || (pathKey !== null && paths.has(pathKey))) {
      invalid('Duplicate media attachment or sort_order')
    }
    slots.add(item.sort_order)
    urls.add(urlKey)
    if (pathKey !== null) paths.add(pathKey)
  }
  media.sort((a, b) => a.sort_order - b.sort_order)
  if (!content && media.length === 0) invalid('content or media_url is required')
  return { userId, content, beerId, media, requestId: requestId ?? headerId }
}
