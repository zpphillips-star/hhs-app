export default function RavenIcon({ size = 100 }: { size?: number }) {
  // No emoji — clean, society-style divider instead
  return (
    <div style={{ width: size * 0.6, height: '1px', background: 'rgba(201,168,76,0.4)', margin: '0 auto' }} />
  )
}
