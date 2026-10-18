'use client'

import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import { createPersonalRatingsStore } from '@/lib/personalRatings'

async function loadPersonalRatings(userId: string) {
  const { data, error } = await supabase.from('ratings')
    .select('user_id,beer_id,stars').eq('user_id', userId)
  if (error) throw error
  return data ?? []
}

export function usePersonalRatings(userId: string | null) {
  const store = useMemo(() => createPersonalRatingsStore(userId, loadPersonalRatings), [userId])
  const ratings = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  useEffect(() => {
    if (!userId) return
    const refresh = () => { if (document.visibilityState !== 'hidden') void store.refresh() }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    // Polling covers remote deletions even when Supabase Realtime is not enabled.
    const timer = window.setInterval(refresh, 30_000)
    return () => {
      store.invalidate()
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [store, userId])
  return { ratings, refresh: store.refresh, record: store.record }
}
