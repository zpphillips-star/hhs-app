'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Image from 'next/image'

type Props = {
  user: { id: string; email?: string } | null
}

export default function Nav({ user }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const links = [
    { href: '/', label: 'Home' },
    { href: '/beers', label: 'Beer Calendar' },
    { href: '/leaderboard', label: 'Members' },
  ]

  return (
    <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }} className="px-6 py-4">
      <div className="container mx-auto max-w-6xl flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/hhs-logo-8.25-1.png" alt="HHS" width={44} height={44} className="opacity-90" />
          <span style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', fontSize: '0.75rem', letterSpacing: '0.3em' }} className="uppercase hidden sm:block">
            HHS
          </span>
        </Link>

        <div className="flex items-center gap-6">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                fontFamily: "'Cinzel', serif",
                color: pathname === link.href ? 'var(--gold)' : 'var(--text-muted)',
                fontSize: '0.75rem',
                letterSpacing: '0.15em',
              }}
              className="uppercase tracking-wider transition-colors hover:text-[var(--gold)]"
            >
              {link.label}
            </Link>
          ))}
          {user ? (
            <button
              onClick={signOut}
              style={{ fontFamily: "'Cinzel', serif", color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.15em' }}
              className="uppercase tracking-wider transition-colors hover:text-[var(--gold)]"
            >
              Sign Out
            </button>
          ) : (
            <Link
              href="/auth"
              style={{ fontFamily: "'Cinzel', serif", color: 'var(--gold)', fontSize: '0.75rem', letterSpacing: '0.15em' }}
              className="uppercase tracking-wider"
            >
              Members Only
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
