'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const PROTECTED_ROUTE_PREFIXES = [
  '/admin',
  '/auth/payment',
  '/beers',
  '/feedback',
  '/kanban',
  '/leaderboard',
  '/membership',
  '/preview',
  '/settings',
  '/wall',
  '/welcome',
]

function isProtectedRoute(pathname: string | null): boolean {
  if (!pathname) return false
  return PROTECTED_ROUTE_PREFIXES.some(prefix =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export default function RouteAuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const protectedRoute = useMemo(() => isProtectedRoute(pathname), [pathname])
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!protectedRoute) return () => { cancelled = true }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return
      if (!user) {
        router.replace('/auth')
        return
      }
      setVerifiedPath(pathname)
    })

    return () => { cancelled = true }
  }, [pathname, protectedRoute, router])

  useEffect(() => {
    if (!protectedRoute) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setVerifiedPath(null)
        router.replace('/auth')
      } else {
        setVerifiedPath(pathname)
      }
    })
    return () => subscription.unsubscribe()
  }, [pathname, protectedRoute, router])

  if (protectedRoute && verifiedPath !== pathname) return null

  return <>{children}</>
}
