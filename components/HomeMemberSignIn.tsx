'use client'

import Link from 'next/link'

export default function HomeMemberSignIn() {
  return (
    <section className="container mx-auto max-w-6xl px-6 pb-12 text-center">
      <Link
        href="/auth"
        style={{
          border: '1px solid var(--gold)',
          color: 'var(--gold)',
          fontFamily: "'Modern Antiqua', serif",
          fontSize: '0.75rem',
          letterSpacing: '0.18em',
          padding: '0.8rem 1.75rem',
          borderRadius: '999px',
          background: 'rgba(217, 124, 43, 0.08)',
        }}
        className="uppercase inline-block hover:opacity-80 transition-opacity"
      >
        Already a member? Sign in
      </Link>
    </section>
  )
}
