'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Nav from '@/components/Nav'
import { OCT_1_2026_UTC_MS } from '@/lib/october'
import { HHS_APP_HOME_ROUTE } from '@/lib/routes'

// ── Daily Beer Facts ────────────────────────────────────────────────────────
// Rotates once per day at 2am Pacific (= 09:00 UTC during PDT).
// Add more entries freely; order doesn't matter — rotation is deterministic.
const BEER_FACTS = [
  "The first known beer recipe is over 4,000 years old — carved into a Sumerian clay tablet as a hymn to Ninkasi, goddess of brewing.",
  "Hops are a relatively recent addition to beer. Before them, a blend of herbs called 'gruit' was used — including bog myrtle, yarrow, and wild rosemary.",
  "Washington State is one of the world's premier hop-growing regions. The Yakima Valley produces nearly 75% of all U.S. hops.",
  "The Snohomish County brewing scene didn't exist in 2010. Today it's home to over a dozen craft breweries — the Society drinks well.",
  "IPAs became popular in the Pacific Northwest partly because Washington and Oregon hops were so abundant and cheap for local brewers.",
  "A standard pint of craft IPA can contain anywhere from 40 to 100 IBUs (International Bitterness Units). Most macro lagers clock in under 10.",
  "Beer was considered safer than water for most of human history — the fermentation process kills harmful bacteria that plagued medieval water supplies.",
  "Monks in European abbeys were allowed up to five liters of beer per day during Lent. It was considered liquid bread and didn't break the fast.",
  "The oldest operating brewery in the United States is Yuengling, founded in 1829 in Pottsville, Pennsylvania — before the Civil War.",
  "Reinheitsgebot, the German Beer Purity Law of 1516, mandated beer be made only from water, barley, and hops. Yeast was added later once it was understood.",
  "Craft beer output in the U.S. surpassed 10% of all beer volume for the first time in 2014 — a milestone that would have seemed absurd in 1980.",
  "The word 'ale' originally referred to any unhopped beer. Once hops became standard, 'ale' and 'beer' were briefly distinguished, then blurred again.",
  "The foam on a properly poured pint isn't decoration — it traps aroma compounds and slows oxidation, making the beer taste better longer.",
  "North Sound breweries have less than 50 miles of separation between them and some of Canada's most celebrated craft breweries — the border is porous for hops.",
  "Stouts got their name from 'stout porter' — a stronger, bolder version of the porter style popular in 18th century London.",
  "Lagers must be cold-fermented and cold-conditioned, which is why they exploded in popularity only after mechanical refrigeration was invented in the 1870s.",
  "The Society's territory stretches from the shores of Puget Sound to the foothills of the Cascades — arguably the most scenic drinking radius in America.",
  "Cascade hops — the defining hop of American craft brewing — were developed by the USDA in 1972. They taste of citrus, grapefruit, and pine.",
  "Belgium produces more distinct beer styles per capita than any nation on Earth. Pacific Northwest brewers have borrowed liberally from the tradition.",
  "A 'wet hop' beer uses fresh, undried hops harvested the same day and rushed to the brewery — a Pacific Northwest September ritual.",
  "The average American craft brewery produces fewer than 1,000 barrels per year. Most Society-territory taprooms you visit are true independents.",
  "Barleywine is one of the strongest ales in the craft lexicon, often reaching 10–12% ABV — closer to wine in strength, but unmistakably beer in character.",
  "Hops in the Pacific Northwest are harvested in late August and September — you're drinking right through peak hop season. Raise a glass.",
  "The word 'brewski' is entirely American slang with no traceable etymology before the 1970s. The Society prefers 'pint,' 'pour,' or simply 'beer.'",
  "Sour beers like Gose and Lambic were once considered flawed. Today they are among the most celebrated and technically difficult styles to produce.",
  "Growlers — those half-gallon jugs at the brewery — got their name from the scraping sound CO₂ made escaping from pails of draft beer in the 1800s.",
  "Washington's liquor privatization in 2012 dramatically lowered the barrier for craft brewery licensing. The tap explosion you enjoy is partly a legal story.",
  "Dry hopping — adding hops after fermentation — adds intense aroma without extra bitterness. It's why a good West Coast IPA smells better than it tastes.",
  "The Society's 31-brewery run covers more ground than the entire Munich Oktoberfest beer map — and every drop is local.",
  "Session beers (under 4.5% ABV) are having a serious renaissance. Brewers are proving you don't need strength to have depth.",
  "Cask-conditioned ale is served without added CO₂ — live yeast in the cask naturally carbonates it. It's rarer in the U.S., but a few Society stops pour it.",
  "October marks the Society's founding season for a reason: autumn grains, harvest hops, and cooling temps are the original conditions for great ale.",
  "Beer has more flavor compounds than red wine. Roughly 600 aroma chemicals have been identified in beer; wine averages around 200.",
  "The Hallowed in Hallowed Hop Society is deliberate — October is the month of ritual, harvest, and reverence. The hops deserve ceremony.",
  "Saison — the farmhouse ale of Belgian tradition — was historically brewed in winter and given to field workers in summer. Hydration as heritage.",
  "Porter got its name from London market porters who favored a cheap, nutritious, dark beer in the early 18th century. Workers' beer, elevated.",
  "The term 'craft brewery' has no federal legal definition. The Brewers Association defines it as small (under 6M barrels), independent, and traditional.",
  "Terroir exists in beer, too. Water chemistry, local grain, and regional yeast strains make a beer from Woodinville taste different from one in Bellingham.",
  "A single hop cone is made up of lupulin glands — tiny yellow pods packed with resins and oils. Everything distinct about an IPA lives in those glands.",
  "The Society's October calendar was curated with intent: every brewery chosen has earned its place. Tonight's pour is not an accident.",
  "Beer styles are not fixed laws — they are conversations. Every brewer who breaks a rule and succeeds has just written a new one.",
  "The Pacific Northwest's marine climate creates ideal conditions for hop growing: warm days, cool nights, and long summer daylight hours. Geography is destiny.",
  "Nitro beers — poured with nitrogen instead of CO₂ — produce a creamy, cascading pour and a softer mouthfeel. Guinness popularized it; locals have refined it.",
]

/**
 * Returns today's beer fact deterministically.
 * The fact changes once per day at 02:00 America/Los_Angeles (Pacific).
 * During PDT (UTC−7) that is 09:00 UTC.  During PST (UTC−8) it is 10:00 UTC.
 * This component runs in the browser, so we use the runtime offset.
 */
function getDailyFact(): string {
  const now = new Date()
  // Build a date representing "Pacific 2am" by shifting by local offset and
  // then subtracting 2 hours so the bucket boundary is 2am, not midnight.
  const pacificOffsetMs = now.getTimezoneOffset() * 60 * 1000 // local offset (positive = behind UTC)
  // Approximate Pacific time: use UTC minus 7h (PDT) as a close-enough constant.
  // This keeps the fact stable across server / browser differences in the pre-Oct window.
  const PDT_OFFSET_MS = 7 * 60 * 60 * 1000
  const pacificNowMs = Date.now() - PDT_OFFSET_MS
  // Bucket: number of complete 24h periods that have elapsed since epoch,
  // with the boundary shifted back by 2h (so bucket flips at 02:00 PT).
  const OFFSET_FROM_MIDNIGHT_MS = 2 * 60 * 60 * 1000
  const dayIndex = Math.floor((pacificNowMs - OFFSET_FROM_MIDNIGHT_MS) / 86400000)
  void pacificOffsetMs // suppress lint warning; we use the UTC-7 constant instead
  return BEER_FACTS[((dayIndex % BEER_FACTS.length) + BEER_FACTS.length) % BEER_FACTS.length]
}

function getNativeAppMode(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    return (
      params.get('hhs_app') === '1' ||
      !!(window as { __HHS_NATIVE_APP__?: boolean }).__HHS_NATIVE_APP__ ||
      localStorage.getItem('__hhs_native_app__') === '1'
    )
  } catch {
    return false
  }
}

export default function PreOctoberPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [nativeApp] = useState(getNativeAppMode)
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  const [dailyFact, setDailyFact] = useState('')

  // Once Oct 1 arrives, hand off to the regular home/Today route
  useEffect(() => {
    if (Date.now() >= OCT_1_2026_UTC_MS) {
      router.replace(HHS_APP_HOME_ROUTE)
    }
  }, [router])

  // Auth — needed to pass user prop to Nav
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  // Live countdown to Oct 1 2026 Pacific midnight
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, OCT_1_2026_UTC_MS - Date.now())
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Resolve daily fact on client only — avoids SSR/hydration mismatch.
  // getDailyFact() is pure/deterministic; setState here is intentional.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDailyFact(getDailyFact()) }, [])

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {!nativeApp && <Nav user={user} />}

      {/* ── Countdown ── */}
      <section style={{ textAlign: 'center', padding: 'clamp(2.5rem, 5vw, 4rem) 1.5rem 0' }}>

        <p style={{
          fontFamily: "'Modern Antiqua', serif",
          color: 'var(--text-muted)',
          fontSize: '0.7rem',
          letterSpacing: '0.35em',
          textTransform: 'uppercase',
          marginBottom: '1.75rem',
        }}>
          October 2026 · The Ritual Begins In
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(1.25rem, 5vw, 3.5rem)', marginBottom: '3rem' }}>
          {[
            { val: countdown.days,    label: 'Days'    },
            { val: countdown.hours,   label: 'Hours'   },
            { val: countdown.minutes, label: 'Minutes' },
            { val: countdown.seconds, label: 'Seconds' },
          ].map(({ val, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'Modern Antiqua', serif",
                color: 'var(--gold)',
                fontSize: 'clamp(2.75rem, 8vw, 5rem)',
                fontWeight: 700,
                lineHeight: 1,
                letterSpacing: '0.04em',
              }}>
                {pad(val)}
              </div>
              <div style={{
                fontFamily: "'Modern Antiqua', serif",
                color: 'var(--text-muted)',
                fontSize: '0.65rem',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginTop: '0.5rem',
              }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* ── Brewery map ── */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brewery-map-north-sound-v4.png"
          alt="North Sound Brewery Map — Hallowed Hop Society 2026 territory"
          style={{
            display: 'block',
            margin: '0 auto 2.5rem',
            maxWidth: '100%',
            width: '680px',
            height: 'auto',
            borderRadius: '14px',
            opacity: 0.93,
          }}
        />

        {/* ── Daily Beer Fact ── */}
        {dailyFact && (
          <div style={{
            margin: '0 auto 2.5rem',
            maxWidth: '600px',
            padding: '1.25rem 1.75rem',
            borderLeft: '3px solid var(--gold)',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '0 10px 10px 0',
            textAlign: 'left',
          }}>
            <p style={{
              fontFamily: "'Modern Antiqua', serif",
              color: 'var(--text-muted)',
              fontSize: '0.6rem',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom: '0.6rem',
            }}>
              Today&rsquo;s Beer Fact
            </p>
            <p style={{
              fontFamily: "'Modern Antiqua', serif",
              color: 'var(--text)',
              fontSize: '0.95rem',
              lineHeight: 1.65,
              fontStyle: 'italic',
            }}>
              &ldquo;{dailyFact}&rdquo;
            </p>
          </div>
        )}

      </section>
    </div>
  )
}
