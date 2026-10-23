export default function Toast({ visible, msg }) {
  return (
    <div
      className={`baggage-toast ${visible ? 'show' : ''}`}
      id="kioskToast"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="material-symbols-outlined text-[20px] text-secondary-fixed">info</span>
      <span id="kioskToastMsg">{msg}</span>
    </div>
  )
}
