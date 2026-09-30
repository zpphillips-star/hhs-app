import type { Metadata } from 'next'
import Link from 'next/link'
import LegalFooter from '@/components/LegalFooter'

export const metadata: Metadata = {
  title: 'Support — Hallowed Hop Society',
  description: 'Support information for Hallowed Hop Society members.',
}

const supportEmail = 'hallowedhopsociety@gmail.com'

export default function SupportPage() {
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
            Support
          </p>
          <h1 style={{ fontSize: 'clamp(2rem, 7vw, 3.4rem)', lineHeight: 1.05, marginBottom: '1rem' }}>
            Need help with HHS?
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Hallowed Hop Society is a private member app for the October beer calendar, today&apos;s beer, the Wall, rankings, feedback, and optional notifications.
          </p>

          <div className="font-body" style={{ display: 'grid', gap: '1.5rem' }}>
            <section>
              <h2 style={{ color: 'var(--gold)', fontSize: '1.15rem', marginBottom: '0.5rem' }}>Contact support</h2>
              <p>
                Email{' '}
                <a href={`mailto:${supportEmail}`} style={{ color: 'var(--gold)' }}>
                  {supportEmail}
                </a>
                {' '}with your name, member email, device/browser, and a short description of what is not working.
              </p>
              <p style={{ marginTop: '0.75rem' }}>
                If you can sign in, you can also use the in-app Feedback page to send bug reports or feature ideas.
              </p>
            </section>

            <section>
              <h2 style={{ color: 'var(--gold)', fontSize: '1.15rem', marginBottom: '0.5rem' }}>Common fixes</h2>
              <ul style={{ paddingLeft: '1.25rem', listStyle: 'disc' }}>
                <li>Sign-in issues: confirm you are using the email address tied to your HHS membership.</li>
                <li>Notifications: make sure notifications are allowed for hallowedhopsociety.com or for the installed native app, then re-check notification settings in HHS.</li>
                <li>Calendar or today&apos;s beer: refresh the app and confirm you are signed in as an approved member.</li>
                <li>Photo uploads: choose only images you want other HHS members or HHS admins to see.</li>
              </ul>
            </section>

            <section>
              <h2 style={{ color: 'var(--gold)', fontSize: '1.15rem', marginBottom: '0.5rem' }}>Privacy</h2>
              <p>
                Read the HHS Privacy Policy at{' '}
                <Link href="/privacy" style={{ color: 'var(--gold)' }}>
                  hallowedhopsociety.com/privacy
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </section>
      <LegalFooter />
    </main>
  )
}
