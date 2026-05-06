export default function RavenIcon({ size = 100 }: { size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      position: 'relative',
      filter: 'drop-shadow(0 0 18px rgba(255,140,0,0.3))',
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mughhs.webp"
        alt="Raven"
        style={{
          width: '220%',
          height: '220%',
          objectFit: 'cover',
          position: 'absolute',
          top: '-30%',
          left: '-55%',
        }}
      />
    </div>
  )
}
