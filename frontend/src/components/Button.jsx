export default function Button({ children, variant = 'primary', className = '', ...props }) {
  return <button className={`btn ${variant === 'accent' ? 'accent' : ''} ${className}`} {...props}>{children}</button>
}
