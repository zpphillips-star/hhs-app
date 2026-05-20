'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SetupBanner() {
  const [show, setShow] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const done = localStorage.getItem('hhs_setup_done')
    if (done) return

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setShow(true)
    })

    // Also listen for auth state changes (e.g. after password reset lands them on a page)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const stillDone = localStorage.getItem('hhs_setup_done')
        if (!stillDone) setShow(true)
      } else {
        setShow(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Hide once setup completes (welcome page calls finish() which sets the flag)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'hhs_setup_done' && e.newValue) setShow(false)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'var(--gold)',
        color: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '0.85rem 1.5rem',
        fontFamily: "'Modern Antiqua', serif",
        fontSize: '0.8rem',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        boxShadow: '0 -2px 20px rgba(0,0,0,0.4)',
      }}
    >
      <span>⚡ Your setup isn&apos;t complete — the app won&apos;t work until you finish.</span>
      <button
        onClick={() => router.push('/welcome')}
        style={{
          background: 'var(--bg)',
          color: 'var(--gold)',
          border: 'none',
          borderRadius: '6px',
          padding: '0.4rem 1rem',
          fontFamily: "'Modern Antiqua', serif",
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          cursor: 'pointer',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        Finish Setup →
      </button>
    </div>
  )
}
