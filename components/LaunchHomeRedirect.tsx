'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { isBeforeOctober2026 } from '@/lib/october'
import { HHS_APP_HOME_ROUTE } from '@/lib/routes'

declare global {
  interface Window {
    __HHS_NATIVE_APP__?: boolean
  }
}

const LAUNCH_CHECKED_KEY = '__hhs_launch_home_checked__'

const APP_SHELL_ROUTES = new Set([
  '/',
  '/about',
  '/beers',
  '/feedback',
  '/leaderboard',
  '/membership',
  '/settings',
  '/wall',
])

function isInstalledAppShell() {
  if (typeof window === 'undefined') return false

  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('hhs_app') === '1') return true
  } catch {
    // Ignore malformed URL state and continue with other signals.
  }

  try {
    if (window.__HHS_NATIVE_APP__ || localStorage.getItem('__hhs_native_app__') === '1') return true
  } catch {
    // Storage can be unavailable in hardened browser modes.
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

function hasExplicitNonLaunchIntent() {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('hhs_notification') === '1'
  } catch {
    return false
  }
}

function homeRouteForCurrentContext() {
  if (isBeforeOctober2026()) return '/'

  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('hhs_app') === '1' || window.__HHS_NATIVE_APP__ || localStorage.getItem('__hhs_native_app__') === '1') {
      return `${HHS_APP_HOME_ROUTE}?hhs_app=1&hhs_view=today`
    }
  } catch {
    // Fall back to the plain web/PWA route.
  }

  return HHS_APP_HOME_ROUTE
}

export default function LaunchHomeRedirect() {
  const pathname = usePathname()
  const router = useRouter()
  const pathnameRef = useRef(pathname)

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    const shouldRouteHome = () => {
      const currentPath = pathnameRef.current
      return (
        isInstalledAppShell() &&
        !!currentPath &&
        currentPath !== HHS_APP_HOME_ROUTE &&
        APP_SHELL_ROUTES.has(currentPath) &&
        !hasExplicitNonLaunchIntent()
      )
    }

    const routeHome = () => {
      if (shouldRouteHome()) router.replace(homeRouteForCurrentContext())
    }

    let launchAlreadyChecked = false
    try {
      launchAlreadyChecked = sessionStorage.getItem(LAUNCH_CHECKED_KEY) === '1'
      sessionStorage.setItem(LAUNCH_CHECKED_KEY, '1')
    } catch {
      // If sessionStorage is unavailable, still apply the launch default once.
    }

    if (!launchAlreadyChecked) routeHome()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') routeHome()
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) routeHome()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [router])

  return null
}
