import Link from 'next/link'

export default function LegalFooter() {
  return (
    <footer
      data-hhs-web-nav="true"
      className="container mx-auto max-w-6xl px-6 pb-10 text-center"
      style={{ color: 'var(--text-muted)' }}
    >
      <div
        style={{
          borderTop: '1px solid var(--border)',
          paddingTop: '1.25rem',
          fontFamily: "'Modern Antiqua', serif",
          fontSize: '0.68rem',
          letterSpacing: '0.14em',
        }}
        className="uppercase"
      >
        <Link href="/privacy" className="transition-colors hover:text-[var(--gold)]">
          Privacy
        </Link>
        <span aria-hidden="true" style={{ margin: '0 0.75rem', color: 'var(--border)' }}>·</span>
        <Link href="/support" className="transition-colors hover:text-[var(--gold)]">
          Support
        </Link>
      </div>
    </footer>
  )
}
