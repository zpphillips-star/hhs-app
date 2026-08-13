'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { HHS_APP_HOME_ROUTE, HHS_SETUP_GATE_ROUTE } from '@/lib/routes'

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

const SETUP_GATED_APP_ROUTE_PREFIXES = [
  '/',
  HHS_APP_HOME_ROUTE,
  '/feedback',
  '/leaderboard',
  '/membership',
  '/settings',
  '/wall',
]

function isProtectedRoute(pathname: string | null): boolean {
  if (!pathname) return false
  return PROTECTED_ROUTE_PREFIXES.some(prefix =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function isSetupGatedAppRoute(pathname: string | null): boolean {
  if (!pathname) return false
  if (pathname === HHS_SETUP_GATE_ROUTE || pathname.startsWith(`${HHS_SETUP_GATE_ROUTE}/`)) return false
  return SETUP_GATED_APP_ROUTE_PREFIXES.some(prefix =>
    pathname === prefix || (prefix !== '/' && pathname.startsWith(`${prefix}/`)),
  )
}

function isPWA() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

function isNativeApp() {
  if (typeof window === 'undefined') return false
  if ((window as { __HHS_NATIVE_APP__?: boolean }).__HHS_NATIVE_APP__) return true
  try { return localStorage.getItem('__hhs_native_app__') === '1' } catch { return false }
}

function canUsePushHere() {
  if (typeof window === 'undefined') return false
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

type SetupProfileRow = {
  username?: string | null
  status?: string | null
  tier?: string | null
  native_membership_amount?: number | null
  has_pwa?: boolean | null
  venmo_clicked_at?: string | null
  payment_review_status?: 'paid' | 'not_paid' | 'not_reviewed' | null
  payment_confirmed_at?: string | null
}

async function readSetupProfile(userId: string): Promise<SetupProfileRow | null> {
  const fullSelect = 'username, status, tier, native_membership_amount, has_pwa, venmo_clicked_at, payment_review_status, payment_confirmed_at'
  const fallbackSelect = 'username, status, tier, native_membership_amount, has_pwa, venmo_clicked_at'
  const result = await supabase
    .from('profiles')
    .select(fullSelect)
    .eq('id', userId)
    .maybeSingle()
  if (result.error && /payment_review_status|payment_confirmed_at/i.test(result.error.message)) {
    const fallback = await supabase
      .from('profiles')
      .select(fallbackSelect)
      .eq('id', userId)
      .maybeSingle()
    return (fallback.data as SetupProfileRow | null) ?? null
  }
  return (result.data as SetupProfileRow | null) ?? null
}

async function isPrelaunchSetupComplete(userId: string): Promise<boolean> {
  const profile = await readSetupProfile(userId)
  if (!profile) return false

  const runningAsPwa = isPWA()
  if (runningAsPwa && profile.has_pwa !== true) {
    supabase.from('profiles').update({ has_pwa: true }).eq('id', userId).then(() => {})
  }

  const profileDone = profile.status === 'approved' && !!profile.username
  const membershipDone = !!profile.tier || typeof profile.native_membership_amount === 'number'
  const installDone = runningAsPwa || profile.has_pwa === true
  const paymentDone = profile.payment_review_status === 'paid' || !!profile.payment_confirmed_at
  const notificationPermission = canUsePushHere() && 'Notification' in window ? Notification.permission : 'denied'
  const { data: pushSub } = await supabase
    .from('push_subscriptions')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  const notificationDone = notificationPermission === 'granted' && !!pushSub

  return profileDone && membershipDone && installDone && paymentDone && notificationDone
}

export default function RouteAuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const protectedRoute = useMemo(() => isProtectedRoute(pathname), [pathname])
  const setupGatedAppRoute = useMemo(() => isSetupGatedAppRoute(pathname), [pathname])
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!protectedRoute && !setupGatedAppRoute) return () => { cancelled = true }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (cancelled) return
      if (!user) {
        if (protectedRoute) router.replace('/auth')
        else setVerifiedPath(pathname)
        return
      }
      if (setupGatedAppRoute && !isNativeApp()) {
        isPrelaunchSetupComplete(user.id).then(complete => {
          if (cancelled) return
          if (!complete) router.replace(HHS_SETUP_GATE_ROUTE)
          else setVerifiedPath(pathname)
        })
        return
      }
      setVerifiedPath(pathname)
    })

    return () => { cancelled = true }
  }, [pathname, protectedRoute, router, setupGatedAppRoute])

  useEffect(() => {
    if (!protectedRoute && !setupGatedAppRoute) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setVerifiedPath(null)
        if (protectedRoute) router.replace('/auth')
        else setVerifiedPath(pathname)
      } else {
        if (setupGatedAppRoute && !isNativeApp()) {
          setVerifiedPath(null)
          isPrelaunchSetupComplete(session.user.id).then(complete => {
            if (!complete) router.replace(HHS_SETUP_GATE_ROUTE)
            else setVerifiedPath(pathname)
          })
          return
        }
        setVerifiedPath(pathname)
      }
    })
    return () => subscription.unsubscribe()
  }, [pathname, protectedRoute, router, setupGatedAppRoute])

  if ((protectedRoute || setupGatedAppRoute) && verifiedPath !== pathname) return null

  return <>{children}</>
}
