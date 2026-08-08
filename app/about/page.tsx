'use client'

import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { supabase } from '@/lib/supabase'
import HomeHeroIntro from '@/components/HomeHeroIntro'
import HomeCountdownJoin from '@/components/HomeCountdownJoin'
import HomeMemberSignIn from '@/components/HomeMemberSignIn'

type User = { id: string; email?: string }

export default function AboutPage() {
  const [user, setUser] = useState<User | null>(null)
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const oct1 = new Date(now.getFullYear(), 9, 1)
      if (now > oct1) oct1.setFullYear(oct1.getFullYear() + 1)
      const diff = oct1.getTime() - now.getTime()
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)
      setCountdown({ days, hours, minutes, seconds })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Nav user={user} />
      <HomeHeroIntro
        media={
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/mughhs.webp"
            alt="Hallowed Hop Society"
            className="hhs-hero-img"
            style={{ opacity: 0.9 }}
          />
        }
      />
      <HomeCountdownJoin countdown={countdown} showJoinCta={!user} />
      {!user && <HomeMemberSignIn />}
    </div>
  )
}
