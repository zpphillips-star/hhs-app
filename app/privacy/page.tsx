import type { Metadata } from 'next'
import Link from 'next/link'
import LegalFooter from '@/components/LegalFooter'

export const metadata: Metadata = {
  title: 'Privacy Policy — Hallowed Hop Society',
  description: 'Privacy information for Hallowed Hop Society members.',
}

const supportEmail = 'hallowedhopsociety@gmail.com'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <section className="container mx-auto max-w-3xl px-6 py-16">
        <Link
          href="/"
          style={{
            color: 'var(--text-muted)',
            fontFamily: "'Modern Antiqua', serif",
            fontSize: '0.68rem',
            letterSpacing: '0.16em',
          }}
          className="uppercase transition-colors hover:text-[var(--gold)]"
        >
          ← Hallowed Hop Society
        </Link>

        <div
          style={{
            marginTop: '2rem',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            background: 'var(--bg-card)',
            padding: 'clamp(1.5rem, 5vw, 3rem)',
          }}
        >
          <p style={{ color: 'var(--gold)', fontSize: '0.72rem', letterSpacing: '0.24em', marginBottom: '0.75rem' }} className="uppercase">
            Privacy Policy
          </p>
          <h1 style={{ fontSize: 'clamp(2rem, 7vw, 3.4rem)', lineHeight: 1.05, marginBottom: '1rem' }}>
            Hallowed Hop Society
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Last updated: September 30, 2026
          </p>

          <div className="font-body" style={{ display: 'grid', gap: '1.5rem' }}>
            <section>
              <h2 style={{ color: 'var(--gold)', fontSize: '1.15rem', marginBottom: '0.5rem' }}>What HHS is</h2>
              <p>
                Hallowed Hop Society is a private member app and website for an October beer-a-day club. Members sign in to view the beer calendar, rate beers, post to the Wall, react or comment, manage basic membership settings, send feedback, and receive optional notifications.
              </p>
            </section>

            <section>
              <h2 style={{ color: 'var(--gold)', fontSize: '1.15rem', marginBottom: '0.5rem' }}>Information we collect</h2>
              <ul style={{ paddingLeft: '1.25rem', listStyle: 'disc' }}>
                <li>Account information you provide, such as email address and member username.</li>
                <li>Membership/setup details used to run the Society, such as selected tier, payment-review status, and app setup status.</li>
                <li>Beer activity you create in the app, including ratings, notes, Wall posts, comments, reactions, and optional feedback submissions.</li>
                <li>Images you choose to upload for Wall posts or feedback.</li>
                <li>Notification preferences and push-subscription tokens if you choose to enable notifications.</li>
                <li>Basic technical information needed to keep the app working, such as browser/app context and server logs from hosting and backend providers.</li>
              </ul>
            </section>

            <section>
              <h2 style={{ color: 'var(--gold)', fontSize: '1.15rem', marginBottom: '0.5rem' }}>How we use information</h2>
              <p>
                We use this information to operate member sign-in, show the beer calendar and today&apos;s beer, save ratings and Wall activity, process member feedback, send app notifications you enable, troubleshoot support issues, prevent abuse, and keep the Society running.
              </p>
            </section>

            <section>
              <h2 style={{ color: 'var(--gold)', fontSize: '1.15rem', marginBottom: '0.5rem' }}>Sharing</h2>
              <p>
                HHS does not sell member information. Member-created content such as usernames, ratings, Wall posts, comments, reactions, and uploaded images may be visible to other HHS members inside the app. We use service providers such as Supabase for authentication/database/storage, Vercel for hosting, and notification/email providers where configured to operate the app.
              </p>
            </section>

            <section>
              <h2 style={{ color: 'var(--gold)', fontSize: '1.15rem', marginBottom: '0.5rem' }}>Payments</h2>
              <p>
                HHS may link members to Venmo for membership-related payments. Payment completion and review status may be recorded in HHS, but HHS does not collect or store payment card numbers.
              </p>
            </section>

            <section>
              <h2 style={{ color: 'var(--gold)', fontSize: '1.15rem', marginBottom: '0.5rem' }}>Your choices</h2>
              <ul style={{ paddingLeft: '1.25rem', listStyle: 'disc' }}>
                <li>You can choose whether to enable browser or native push notifications.</li>
                <li>You can submit app feedback through the Feedback page when signed in.</li>
                <li>You can request help updating or deleting account/content information by contacting HHS support.</li>
              </ul>
            </section>

            <section>
              <h2 style={{ color: 'var(--gold)', fontSize: '1.15rem', marginBottom: '0.5rem' }}>Contact</h2>
              <p>
                For privacy or account-support requests, email{' '}
                <a href={`mailto:${supportEmail}`} style={{ color: 'var(--gold)' }}>
                  {supportEmail}
                </a>
                {' '}or use the in-app Feedback page if you can sign in.
              </p>
            </section>
          </div>
        </div>
      </section>
      <LegalFooter />
    </main>
  )
}
