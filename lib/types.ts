export type Beer = {
  id: string
  day_number: number
  name: string
  brewery: string
  style: string | null
  abv: number | null
  description: string | null
  image_url: string | null
  ai_notes: string | null
  created_at: string
}

export type Post = {
  id: string
  user_id: string
  beer_id: string
  content: string
  photo_url: string | null
  created_at: string
  profiles?: { username: string; display_name: string | null }
  post_reactions?: PostReaction[]
  post_comments?: PostComment[]
}

export type PostReaction = {
  id: string
  post_id: string
  user_id: string
  reaction: 'cheers' | 'dead' | 'fire' | 'trophy' | 'rough'
  created_at: string
}

export type PostComment = {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: { username: string; display_name: string | null }
}

export type Rating = {
  id: string
  user_id: string
  beer_id: string
  stars: number
  notes: string | null
  created_at: string
  profiles?: Profile
  beers?: Beer
}

export type Profile = {
  id: string
  username: string
  display_name: string | null
  created_at: string
}
