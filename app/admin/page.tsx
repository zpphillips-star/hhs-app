'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Beer } from '@/lib/types'
import Nav from '@/components/Nav'

type MemberRequest = {
  id: string
  first_name: string
  last_name: string
  email: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export default function AdminPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [beers, setBeers] = useState<Beer[]>([])
  const [dayNumber, setDayNumber] = useState(1)
  const [name, setName] = useState('')
  const [brewery, setBrewery] = useState('')
  const [style, setStyle] = useState('')
  const [abv, setAbv] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [requests, setRequests] = useState<MemberRequest[]>([])
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewMsg, setReviewMsg] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    fetchBeers()
    fetchRequests()
  }, [])

  const fetchBeers = async () => {
    const { data } = await supabase.from('beers').select('*').order('day_number')
    setBeers(data || [])
  }

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('member_requests')
      .select('*')
      .order('created_at', { ascending: false })
    setRequests(data || [])
  }

  const handleReview = async (requestId: string, action: 'approve' | 'reject') => {
    setReviewingId(requestId)
    try {
      const res = await fetch('/api/approve-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ''}`,
        },
        body: JSON.stringify({ request_id: requestId, action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setReviewMsg(prev => ({ ...prev, [requestId]: `Error: ${data.error}` }))
      } else {
        setReviewMsg(prev => ({ ...prev, [requestId]: action === 'approve' ? '✅ Approved — invite sent' : '✗ Rejected' }))
        fetchRequests()
      }
    } catch {
      setReviewMsg(prev => ({ ...prev, [requestId]: 'Something went wrong.' }))
    }
    setReviewingId(null)
  }

  const loadBeerForEdit = (beer: Beer) => {
    setDayNumber(beer.day_number)
    setName(beer.name)
    setBrewery(beer.brewery)
    setStyle(beer.style || '')
    setAbv(beer.abv?.toString() || '')
    setDescription(beer.description || '')
    setMessage('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const { error } = await supabase.from('beers').upsert({
      day_number: dayNumber,
      name,
      brewery,
      style: style || null,
      abv: abv ? parseFloat(abv) : null,
      description: description || null,
    }, { onConflict: 'day_number' })

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage(`✅ Day ${dayNumber} saved!`)
      setName('')
      setBrewery('')
      setStyle('')
      setAbv('')
      setDescription('')
      await fetchBeers()
    }

    setSaving(false)
  }

  const deleteBeer = async (id: string, dayNum: number) => {
    if (!confirm(`Delete Day ${dayNum} beer?`)) return
    await supabase.from('beers').delete().eq('id', id)
    fetchBeers()
  }

  return (
    <div className="min-h-screen bg-[#0d0b0f]">
      <Nav user={user} />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-orange-400">⚙️ Admin — Manage Beers</h1>
          <span className="text-sm text-gray-500">{beers.length}/31 entered</span>
        </div>

        {/* Add / Edit form */}
        <div className="bg-[#1a1520] border border-purple-900/60 rounded-2xl p-6 mb-8">
          <h2 className="text-white font-semibold mb-4 text-sm uppercase tracking-wider">Add or Edit Beer</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Day Number *</label>
                <input
                  type="number" min={1} max={31}
                  value={dayNumber}
                  onChange={e => setDayNumber(parseInt(e.target.value))}
                  required
                  className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">ABV %</label>
                <input
                  type="number" step="0.1" min="0" max="20"
                  value={abv}
                  onChange={e => setAbv(e.target.value)}
                  className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                  placeholder="5.5"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Beer Name *</label>
              <input
                type="text" value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                placeholder="Pumpkin Spice Stout"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Brewery *</label>
              <input
                type="text" value={brewery}
                onChange={e => setBrewery(e.target.value)}
                required
                className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                placeholder="Haunted Brewing Co."
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Style</label>
              <input
                type="text" value={style}
                onChange={e => setStyle(e.target.value)}
                className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                placeholder="Imperial Stout"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1 uppercase tracking-wider">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-[#0d0b0f] border border-purple-800 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500 resize-none"
                placeholder="Dark, rich, and dangerously drinkable..."
              />
            </div>

            {message && (
              <p className={`text-sm ${message.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>{message}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-2.5 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : `Save Day ${dayNumber}`}
            </button>
          </form>
        </div>

        {/* Beer list */}
        <h2 className="text-lg font-semibold text-white mb-3">Entered Beers</h2>
        {beers.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-8">No beers entered yet. Add your first one above.</p>
        ) : (
          <div className="space-y-2">
            {beers.map(beer => (
              <div key={beer.id} className="bg-[#1a1520] border border-purple-900/40 rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-orange-400 font-bold w-7 text-center text-sm shrink-0">{beer.day_number}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate">{beer.name}</div>
                  <div className="text-gray-500 text-xs">{beer.brewery}{beer.style ? ` · ${beer.style}` : ''}{beer.abv ? ` · ${beer.abv}%` : ''}</div>
                </div>
                <button
                  onClick={() => loadBeerForEdit(beer)}
                  className="text-xs text-blue-400 hover:text-blue-300 shrink-0"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteBeer(beer.id, beer.day_number)}
                  className="text-xs text-red-500 hover:text-red-400 shrink-0"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Membership Requests */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Membership Requests</h2>
            <span className="text-sm text-gray-500">
              {requests.filter(r => r.status === 'pending').length} pending
            </span>
          </div>

          {requests.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-8">No membership requests yet.</p>
          ) : (
            <div className="space-y-2">
              {requests.map(req => (
                <div key={req.id} className="bg-[#1a1520] border border-purple-900/40 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium">
                        {req.first_name} {req.last_name}
                      </div>
                      <div className="text-gray-500 text-xs">{req.email}</div>
                      <div className="text-gray-600 text-xs mt-0.5">
                        {new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {req.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => handleReview(req.id, 'approve')}
                            disabled={reviewingId === req.id}
                            className="text-xs bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {reviewingId === req.id ? '...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleReview(req.id, 'reject')}
                            disabled={reviewingId === req.id}
                            className="text-xs bg-red-500/10 hover:bg-red-500/30 text-red-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <span className={`text-xs font-medium ${req.status === 'approved' ? 'text-green-500' : 'text-gray-500'}`}>
                          {req.status === 'approved' ? 'Approved' : 'Rejected'}
                        </span>
                      )}
                    </div>
                  </div>
                  {reviewMsg[req.id] && (
                    <p className="text-xs mt-2 text-gray-400">{reviewMsg[req.id]}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

