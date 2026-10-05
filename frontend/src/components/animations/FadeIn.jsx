/** Staggered entrance wrapper: fade + rise, GPU-friendly. */
export default function FadeIn({ children, delay = 0, className = '', as: Tag = 'div', style }) {
  return (
    <Tag
      className={`anim-fade-up ${className}`}
      style={{ '--anim-delay': `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  )
}
