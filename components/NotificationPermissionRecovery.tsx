'use client'

import type { CSSProperties } from 'react'

export type NotificationPermissionState = NotificationPermission | 'unsupported'
export type NotificationBrowser =
  | 'chrome'
  | 'edge'
  | 'brave'
  | 'samsung'
  | 'opera'
  | 'firefox'
  | 'safari'
  | 'other'

export function isIOSDevice() {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function isInstalledPwa() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  )
}

export function canUseWebPushHere() {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false
  // iOS/iPadOS only exposes Web Push permission to installed Home Screen PWAs.
  // Regular Safari/Chrome/Edge tabs cannot trigger or recover the PWA prompt.
  if (isIOSDevice() && !isInstalledPwa()) return false
  return true
}

export function getNotificationPermissionState(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export function detectNotificationBrowser(): NotificationBrowser {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  if (/Edg\/|EdgA\//.test(ua)) return 'edge'
  if ((navigator as { brave?: { isBrave?: unknown } }).brave) return 'brave'
  if (/SamsungBrowser/.test(ua)) return 'samsung'
  if (/OPR\/|Opera/.test(ua)) return 'opera'
  if (/Firefox/.test(ua)) return 'firefox'
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return 'safari'
  if (/Chrome/.test(ua)) return 'chrome'
  return 'other'
}

function browserDisplayName(browser: NotificationBrowser) {
  return {
    chrome: 'Chrome',
    edge: 'Edge',
    brave: 'Brave',
    samsung: 'Samsung Internet',
    opera: 'Opera',
    firefox: 'Firefox',
    safari: 'Safari',
    other: 'your browser',
  }[browser]
}

function recoverySteps(permission: NotificationPermissionState, browser: NotificationBrowser) {
  if (permission === 'unsupported') {
    if (isIOSDevice() && !isInstalledPwa()) {
      return {
        title: 'Open the installed HHS app first',
        steps: [
          'On iPhone/iPad, notifications can only be enabled from the HHS Home Screen app — not a normal Safari tab.',
          'Add HHS to your Home Screen if needed, open it from that icon, then tap Enable Notifications there.',
          'If HHS still does not appear in iOS notification settings, iOS has not created the app permission yet.',
        ],
      }
    }

    if (browser === 'firefox') {
      return {
        title: 'Firefox cannot enable HHS push here',
        steps: [
          'Open HHS in Chrome or Edge on Android, or from the installed HHS app.',
          'Then return to this screen and tap Enable Notifications.',
        ],
      }
    }

    return {
      title: 'Notifications are not available here',
      steps: [
        'Open HHS in Chrome or Edge on Android, or from the installed HHS app.',
        'Then return to this screen and tap Enable Notifications.',
      ],
    }
  }

  if (isIOSDevice()) {
    return {
      title: 'Notifications are blocked for HHS',
      steps: [
        'Open iOS Settings → Notifications → HHS.',
        'Turn on Allow Notifications.',
        'Return to HHS. This screen will re-check automatically.',
      ],
    }
  }

  if (browser === 'safari') {
    return {
      title: 'Notifications are blocked in Safari',
      steps: [
        'Open Safari Settings → Websites → Notifications.',
        'Find hallowedhopsociety.com and change it to Allow.',
        'Return to HHS. This screen will re-check automatically.',
      ],
    }
  }

  if (browser === 'firefox') {
    return {
      title: 'Notifications are blocked in Firefox',
      steps: [
        'Click the lock/site-info icon next to the address.',
        'Under Permissions, allow Send Notifications or remove the blocked permission.',
        'Return to HHS. This screen will re-check automatically.',
      ],
    }
  }

  const name = browserDisplayName(browser)
  return {
    title: `Notifications are blocked in ${name}`,
    steps: [
      'Tap the lock/site-info icon next to the address bar.',
      `Open Permissions → Notifications and choose Allow for hallowedhopsociety.com. On Android, you can also use ${name} Settings → Site settings → Notifications → hallowedhopsociety.com → Allow.`,
      'Return to HHS. This screen will re-check automatically.',
    ],
  }
}

export function NotificationPermissionRecovery({
  permission,
  browser = detectNotificationBrowser(),
  style,
  textStyle,
}: {
  permission: NotificationPermissionState
  browser?: NotificationBrowser
  style?: CSSProperties
  textStyle?: CSSProperties
}) {
  const copy = recoverySteps(permission, browser)

  return (
    <div style={style}>
      <p style={{
        color: 'var(--gold)',
        fontFamily: "'Modern Antiqua', serif",
        fontSize: '0.72rem',
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        margin: '0 0 0.65rem',
      }}>
        {copy.title}
      </p>
      <ol style={{
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
        lineHeight: 1.65,
        margin: 0,
        paddingLeft: '1.1rem',
        ...textStyle,
      }}>
        {copy.steps.map(step => (
          <li key={step} style={{ marginBottom: '0.35rem' }}>{step}</li>
        ))}
      </ol>
    </div>
  )
}
