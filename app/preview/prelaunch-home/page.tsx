import type { Metadata } from 'next'
import PrelaunchHomePreview from './PrelaunchHomePreview'

export const metadata: Metadata = {
  title: 'Prelaunch Home — HHS',
  description: 'Non-discoverable HHS prelaunch home.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

export default function PrelaunchHomePreviewPage() {
  return <PrelaunchHomePreview />
}
