import { useCallback } from 'react'

export default function Step1({ currentStep, goToStep, simulateFaceScan, openManualBarcodeModal }) {
  const now = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const handleRescan = useCallback(() => {
    simulateFaceScan()
  }, [simulateFaceScan])

  const handleManualBarcode = useCallback(() => {
    openManualBarcodeModal()
  }, [openManualBarcodeModal])

  const handleProceed = useCallback(() => {
    goToStep(2)
  }, [goToStep])

  if (currentStep !== 1) return null

  return (
    <div className="step-content space-y-space-md" id="step-1">
      <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[16px]">fingerprint</span>
            <span>Step 1 of 6 • Identity Verification</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Please Look Directly at the Camera</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Ensure glasses and hats do not cast shadows. The biometric system will match your flight reservation automatically.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-2 rounded-lg bg-surface-container text-primary font-label-md text-label-md flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            <span>Camera 01 • Active HD</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
        <div className="lg:col-span-7 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col items-center text-center relative overflow-hidden">
          <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl bg-surface-container-high overflow-hidden flex items-center justify-center shadow-inner">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-surface-container to-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[140px] text-primary/30">person</span>
            </div>
            <div
              className="relative z-10 w-44 h-60 rounded-[48%] border-2 border-primary border-dashed flex flex-col items-center justify-between py-6 transition-all duration-500"
              id="biometricGuide"
            >
              <div className="w-8 h-1 bg-primary rounded-full"></div>
              <div className="w-full h-0.5 bg-primary/60 shadow-[0_0_12px_rgba(0,97,148,0.8)] animate-pulse" id="scanLine"></div>
              <div className="w-8 h-1 bg-primary rounded-full"></div>
            </div>
            <div className="absolute bottom-4 left-4 right-4 bg-surface-container-lowest/95 backdrop-blur-md p-3 rounded-xl shadow-md flex items-center justify-between" id="matchBadge">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-on-secondary">
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                </div>
                <div className="text-left">
                  <span className="font-label-sm text-label-sm text-secondary font-bold uppercase tracking-wider block">Biometric Confirmed</span>
                  <span className="font-label-md text-label-md text-on-surface">DOE, JOHNATHAN MR • 98.6%</span>
                </div>
              </div>
              <span className="px-2 py-1 rounded bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">Match OK</span>
            </div>
          </div>
          <div className="mt-space-md w-full flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              className="w-full sm:w-auto px-space-md py-3.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md shadow-sm hover:bg-primary-container active:scale-95 transition-all flex items-center justify-center gap-2"
              onClick={handleRescan}
            >
              <span className="material-symbols-outlined text-[20px]">face</span>
              <span>Re-Scan Face</span>
            </button>
            <button
              className="w-full sm:w-auto px-space-md py-3.5 rounded-xl bg-surface-container-low text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-all flex items-center justify-center gap-2"
              onClick={handleManualBarcode}
            >
              <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
              <span>Scan Boarding Pass Manually</span>
            </button>
          </div>
        </div>
        <div className="lg:col-span-5 space-y-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm space-y-space-sm">
            <div className="flex items-center justify-between pb-3 bg-surface-container-low -mx-space-md -mt-space-md px-space-md pt-space-md rounded-t-xl">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-primary text-on-primary font-bold text-center flex items-center justify-center font-label-sm text-label-sm">QR</span>
                <div>
                  <span className="font-headline-sm text-headline-sm text-on-surface">Flight QR-082</span>
                  <span className="block font-label-sm text-label-sm text-on-surface-variant">Qatar Airways • Boeing 777-300ER</span>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm uppercase font-bold">On Time</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="font-label-sm text-label-sm text-on-surface-variant block">Departing</span>
                <span className="font-headline-md text-headline-md text-primary">DOH</span>
                <span className="font-body-md text-body-md text-on-surface">Doha Hamad Intl</span>
              </div>
              <div className="text-right">
                <span className="font-label-sm text-label-sm text-on-surface-variant block">Boarding</span>
                <span className="font-headline-md text-headline-md text-on-surface">14:15</span>
                <span className="font-body-md text-body-md text-on-surface">Gate B22 • Zone 2</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant font-label-sm text-label-sm">Passenger Name:</span>
                <span className="font-label-md text-label-md text-on-surface font-bold">DOE, JOHNATHAN MR</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant font-label-sm text-label-sm">Booking Ref / PNR:</span>
                <span className="font-label-md text-label-md text-primary font-bold font-mono">QR-9Y8K2X</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant font-label-sm text-label-sm">Cabin &amp; Seat:</span>
                <span className="font-label-md text-label-md text-on-surface">Economy Class • 24A (Window)</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-on-surface-variant font-label-sm text-label-sm">Baggage Entitlement:</span>
                <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">2 Bags (23 kg each)</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-tertiary mt-0.5">battery_alert</span>
              <div className="text-xs space-y-0.5">
                <span className="font-bold block">Cabin Only Baggage Rules</span>
                <p className="font-body-md text-body-md text-on-tertiary-fixed">
                  Spare lithium batteries, power banks, and electronic vapes MUST remain in your carry-on luggage. Do not place in drop.
                </p>
              </div>
            </div>
          </div>
          <button
            className="w-full h-16 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-md hover:bg-primary-container active:scale-[0.99] transition-all flex items-center justify-center gap-3"
            onClick={handleProceed}
          >
            <span>Confirm Identity &amp; Proceed to Baggage Drop</span>
            <span className="material-symbols-outlined text-[24px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  )
}
