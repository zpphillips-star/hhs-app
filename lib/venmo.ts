export type HhsPaymentTier = 'hallowed' | 'oddballs'

export const HHS_PAYMENT_TIERS = {
  hallowed: {
    label: 'Hallowed',
    displayLabel: 'The Hallowed',
    amount: 150,
    beers: 31,
    desc: 'Every day of October',
    venmoNote: 'HHS Hallowed Membership 2026',
  },
  oddballs: {
    label: 'Oddballs',
    displayLabel: 'The Oddballs',
    amount: 100,
    beers: 16,
    desc: 'Odd days only',
    venmoNote: 'HHS Oddballs Membership 2026',
  },
} as const

export function buildHhsVenmoUrls(tier: HhsPaymentTier) {
  const config = HHS_PAYMENT_TIERS[tier]
  const note = encodeURIComponent(config.venmoNote)
  return {
    appUrl: `venmo://paycharge?txn=pay&recipients=zpphillips&amount=${config.amount}&note=${note}`,
    webUrl: `https://venmo.com/zpphillips?txn=pay&amount=${config.amount}&note=${note}`,
  }
}

export function openHhsVenmoPayment(tier: HhsPaymentTier) {
  const { appUrl, webUrl } = buildHhsVenmoUrls(tier)
  const start = Date.now()
  window.location.href = appUrl
  window.setTimeout(() => {
    if (Date.now() - start < 1500) window.open(webUrl, '_blank')
  }, 800)
}
