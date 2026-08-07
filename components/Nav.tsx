'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { MouseEvent, useEffect, useState } from 'react'

// Extend Window to accommodate the React Native WebView bridge
declare global {
  interface Window {
    __HHS_NATIVE_APP__?: boolean
    ReactNativeWebView?: { postMessage: (msg: string) => void }
  }
}

type Props = {
  user: { id: string; email?: string } | null
}

export default function Nav({ user }: Props) {
  const pathname = usePathname()
  const [isNativeApp, setIsNativeApp] = useState(false)
  const [hideNativeFallbackChrome, setHideNativeFallbackChrome] = useState(false)

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return

      try {
        const nativeFallbackRoute = pathname === '/wall' || pathname === '/leaderboard'
        const nativeFallbackMarker =
          new URLSearchParams(window.location.search).get('hhs_native_fallback') === '1' ||
          sessionStorage.getItem('__hhs_native_fallback__') === '1'

        setIsNativeApp(
          Boolean(
            window.__HHS_NATIVE_APP__ ||
            localStorage.getItem('__hhs_native_app__') === '1'
          )
        )
        setHideNativeFallbackChrome(nativeFallbackRoute && nativeFallbackMarker)
      } catch {
        // storage or window not available — stay false
      }
    })

    return () => {
      cancelled = true
    }
  }, [pathname])

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search)
    const nativeApp =
      params.get('hhs_app') === '1' ||
      (window as { __HHS_NATIVE_APP__?: boolean }).__HHS_NATIVE_APP__ ||
      localStorage.getItem('__hhs_native_app__') === '1'
    if (nativeApp) return null
  }

  const openNativeMenu = () => {
    try {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'HHS_OPEN_MENU' }))
    } catch {
      // bridge not available
    }
  }

  const handleTopNavClick = (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isNativeApp) return

    // Android WebView has been more reliable with document-level navigation
    // than with Next client transitions for the persistent top nav.
    event.preventDefault()
    window.location.assign(href)
  }

  const links = [
    { href: '/beers', label: 'The Beer' },
    { href: '/wall', label: 'The Wall' },
    { href: '/leaderboard', label: 'The Rankings' },
    ...(user ? [{ href: '/membership', label: 'The Settings' }] : []),
  ]
  const mobileLinks = user
    ? [
        { href: '/beers', label: 'The Beer' },
        { href: '/wall', label: 'The Wall' },
        { href: '/', label: 'HHS', isHomeLogo: true },
        { href: '/leaderboard', label: 'The Rankings' },
        { href: '/membership', label: 'The Settings' },
      ]
    : []

  if (hideNativeFallbackChrome) return null

  return (
    <>
      <nav data-hhs-web-nav="true" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }} className="hhs-desktop-nav px-6 py-4">
        <div className="container mx-auto max-w-6xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3" onClick={handleTopNavClick('/')}>
            <Image src="/hhs-nav-icon.webp" alt="HHS" width={44} height={26} className="opacity-90" />
          </Link>

          <div className="flex items-center gap-6">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={handleTopNavClick(link.href)}
                style={{
                  fontFamily: "'Modern Antiqua', serif",
                  color: pathname === link.href ? 'var(--gold)' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  letterSpacing: '0.15em',
                }}
                className="uppercase tracking-wider transition-colors hover:text-[var(--gold)]"
              >
                {link.label}
              </Link>
            ))}

            {isNativeApp ? (
              /* Hamburger — replaces Members Only / Sign Out in native app */
              <button
                onClick={openNativeMenu}
                aria-label="Open menu"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 2px',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ display: 'block', width: '20px', height: '2px', background: 'var(--gold)', borderRadius: '1px' }} />
                <span style={{ display: 'block', width: '20px', height: '2px', background: 'var(--gold)', borderRadius: '1px' }} />
                <span style={{ display: 'block', width: '20px', height: '2px', background: 'var(--gold)', borderRadius: '1px' }} />
              </button>
            ) : !user ? (
              <Link
                href="/auth"
                onClick={handleTopNavClick('/auth')}
                style={{ fontFamily: "'Modern Antiqua', serif", color: 'var(--gold)', fontSize: '0.75rem', letterSpacing: '0.15em' }}
                className="uppercase tracking-wider"
              >
                Members Only
              </Link>
            ) : null}
          </div>
        </div>
      </nav>

      {user ? (
        <>
          <nav
            data-hhs-web-nav="true"
            aria-label="Primary mobile navigation"
            className="hhs-mobile-bottom-nav"
          >
            {mobileLinks.map(link => {
              const isActive = link.href === '/' ? pathname === '/' : pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={handleTopNavClick(link.href)}
                  style={{
                    fontFamily: "'Modern Antiqua', serif",
                    color: isActive ? 'var(--gold)' : 'var(--text-muted)',
                  }}
                  className={`hhs-mobile-bottom-nav-link uppercase tracking-wider transition-colors hover:text-[var(--gold)]${link.isHomeLogo ? ' hhs-mobile-bottom-nav-home' : ''}`}
                >
                  {link.isHomeLogo ? (
                    <span className="hhs-mobile-bottom-nav-logo-ring" aria-hidden="true">
                      <Image
                        src="/hhs-nav-icon.webp"
                        alt=""
                        width={44}
                        height={26}
                        className="hhs-mobile-bottom-nav-logo"
                      />
                    </span>
                  ) : link.label.startsWith('The ') ? (
                    <span className="hhs-mobile-bottom-nav-stack">
                      <span>The</span>
                      <span>{link.label.slice(4)}</span>
                    </span>
                  ) : (
                    link.label
                  )}
                </Link>
              )
            })}
          </nav>
          <div className="hhs-mobile-bottom-nav-spacer" aria-hidden="true" />
        </>
      ) : null}
    </>
  )
}

