export type Beer = {
  id: string
  day_number: number
  name: string
  brewery: string
  style: string | null
  abv: number | null
  description: string | null
  image_url: string | null
  created_at: string
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
