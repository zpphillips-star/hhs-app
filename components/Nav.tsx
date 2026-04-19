'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Props = {
  user: { email?: string } | null
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
    { href: '/', label: '🎃 Today' },
    { href: '/beers', label: '🍺 Beers' },
    { href: '/leaderboard', label: '🏆 Board' },
  ]

  return (
    <nav className="bg-[#0d0b0f] border-b border-purple-900/60 px-4 py-3">
      <div className="container mx-auto max-w-2xl flex items-center justify-between">
        <div className="flex gap-4">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                pathname === link.href
                  ? 'text-orange-400'
                  : 'text-gray-500 hover:text-orange-300'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="text-gray-600 text-xs hidden sm:block">
                {user.email?.split('@')[0]}
              </span>
              <button
                onClick={signOut}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/auth"
              className="text-sm text-orange-400 hover:text-orange-300 font-medium"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
