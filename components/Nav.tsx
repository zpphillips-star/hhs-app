'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'
import { useState, useEffect, useRef } from 'react'

type Props = {
  user: { id: string; email?: string } | null
}

export default function Nav({ user }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const signOut = async () => {
    setMenuOpen(false)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Close menu on route change
  useEffect(() => { setMenuOpen(false) }, [pathname])

  const menuLinks = [
    { href: '/beers', label: 'The Beer' },
    { href: '/wall', label: 'The Wall' },
    { href: '/leaderboard', label: 'The Rankings' },
  ]

  return (
    <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }} className="px-6 py-4">
      {/* FIX 3: relative container so logo can be absolutely centered */}
      <div className="container mx-auto max-w-6xl relative flex items-center justify-between" style={{ minHeight: 44 }}>

        {/* Left: nav links (hidden on small screens or push to left) */}
        <div className="flex items-center gap-6">
          {menuLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontFamily: "'Modern Antiqua', serif",
                color: pathname === link.href ? 'var(--gold)' : 'var(--text-muted)',
                fontSize: '0.75rem',
                letterSpacing: '0.15em',
              }}
              className="uppercase tracking-wider transition-colors hover:text-[var(--gold)] hidden sm:inline-block"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* FIX 3: HHS logo — absolutely centered in the nav bar */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Link href="/" style={{ pointerEvents: 'auto' }} aria-label="Hallowed Hop Society home">
            <Image src="/hhs-nav-icon.webp" alt="HHS" width={44} height={26} className="opacity-90" />
          </Link>
        </div>

        {/* Right: FEATURE 1 — hamburger menu */}
        <div className="flex items-center" ref={menuRef} style={{ position: 'relative', zIndex: 50 }}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            style={{
              background: 'none',
              border: menuOpen ? '1px solid var(--border)' : 'none',
              borderRadius: 8,
              padding: '6px 8px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Hamburger icon */}
            <span style={{ display: 'block', width: 20, height: 2, background: menuOpen ? 'var(--gold)' : 'var(--text-muted)', borderRadius: 2, transition: 'background 0.2s' }} />
            <span style={{ display: 'block', width: 20, height: 2, background: menuOpen ? 'var(--gold)' : 'var(--text-muted)', borderRadius: 2, transition: 'background 0.2s' }} />
            <span style={{ display: 'block', width: 20, height: 2, background: menuOpen ? 'var(--gold)' : 'var(--text-muted)', borderRadius: 2, transition: 'background 0.2s' }} />
          </button>

          {/* Dropdown menu */}
          {menuOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              minWidth: 180,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
              padding: '6px 0',
              zIndex: 100,
            }}>
              {/* Mobile nav links */}
              <div className="sm:hidden">
                {menuLinks.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: 'block',
                      padding: '10px 18px',
                      fontFamily: "'Modern Antiqua', serif",
                      color: pathname === link.href ? 'var(--gold)' : 'var(--text)',
                      fontSize: '0.78rem',
                      letterSpacing: '0.15em',
                      textDecoration: 'none',
                      textTransform: 'uppercase',
                    }}
                  >
                    {link.label}
                  </Link>
                ))}
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              </div>

              <MenuRow href="/feedback" label="Feedback" onClick={() => setMenuOpen(false)} />
              <MenuRow href="/settings" label="Settings" onClick={() => setMenuOpen(false)} />
              <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
              {user ? (
                <button
                  onClick={signOut}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 18px',
                    fontFamily: "'Modern Antiqua', serif",
                    color: 'var(--text-muted)',
                    fontSize: '0.78rem',
                    letterSpacing: '0.15em',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  Sign Out
                </button>
              ) : (
                <MenuRow href="/auth" label="Sign In" gold onClick={() => setMenuOpen(false)} />
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}

function MenuRow({
  href,
  label,
  gold,
  onClick,
}: {
  href: string
  label: string
  gold?: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: 'block',
        padding: '10px 18px',
        fontFamily: "'Modern Antiqua', serif",
        color: gold ? 'var(--gold)' : 'var(--text)',
        fontSize: '0.78rem',
        letterSpacing: '0.15em',
        textDecoration: 'none',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </Link>
  )
}

