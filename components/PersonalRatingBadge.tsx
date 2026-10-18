import Image from 'next/image'
import { ratingBadgeLabel, ratingBadgeStars } from '@/lib/personalRatings'

export default function PersonalRatingBadge({ stars }: { stars?: number }) {
  const rating = ratingBadgeStars(stars)
  if (!rating) return null
  const label = ratingBadgeLabel(rating)
  return (
    <Image
      src={`/rating-icons/hhs-rating-${rating}-${rating === 1 ? 'star' : 'stars'}.png`}
      alt={label}
      title={label}
      width={40}
      height={40}
      unoptimized
      style={{ width: 40, height: 40, flexShrink: 0, objectFit: 'contain' }}
    />
  )
}
