export default function ManualBarcodeModal({ open, onClose, onConfirm }) {
  if (!open) return null

  return (
    <div className="baggage-modal-overlay" id="manualBarcodeModal" role="dialog" aria-modal="true" aria-label="Manual Boarding Pass">
      <div className="bg-surface-container-lowest max-w-md w-full rounded-2xl p-space-md shadow-2xl space-y-space-md">
        <div className="flex justify-between items-center">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">Manual Boarding Pass</h3>
          <button
            className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant"
            onClick={onClose}
            aria-label="Close manual boarding pass modal"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Place your digital boarding pass QR code or printed ticket over the scanner glass window.
        </p>
        <div className="w-full h-44 rounded-xl bg-surface-container-high flex flex-col items-center justify-center text-on-surface-variant space-y-2">
          <span className="material-symbols-outlined text-[48px] text-primary">qr_code_scanner</span>
          <span className="font-mono text-xs">Waiting for Barcode Beam...</span>
        </div>
        <button
          className="w-full py-3.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-sm"
          onClick={onConfirm}
        >
          Simulate Boarding Pass Scan (Pass)
        </button>
      </div>
    </div>
  )
}
