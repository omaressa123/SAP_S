import { useCallback } from 'react'

export default function Step5({
  currentStep,
  scanStatus,
  simulateScanError,
  simulateScanSuccess,
  dispatchLuggageToFlight,
  goToStep,
}) {
  const handleBack = useCallback(() => {
    goToStep(4)
  }, [goToStep])

  const handleError = useCallback(() => {
    simulateScanError()
  }, [simulateScanError])

  const handleSuccess = useCallback(() => {
    simulateScanSuccess()
  }, [simulateScanSuccess])

  const handleDispatch = useCallback(() => {
    dispatchLuggageToFlight()
  }, [dispatchLuggageToFlight])

  const isError = scanStatus === 'error'
  const isSuccess = scanStatus === 'success'

  if (currentStep !== 5) return null

  return (
    <div className="step-content space-y-space-md hidden" id="step-5">
      <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
            <span>Step 5 of 6 • Automated Verification &amp; Sorter Dispatch</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Optical Tunnel Verification</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Multi-angle laser scanners and RFID tunnel antennas are reading your attached bag tag.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-2.5 py-1.5 rounded-lg bg-surface-container-high text-tertiary font-label-sm text-label-sm hover:bg-surface-container-highest transition-all flex items-center gap-1"
            onClick={handleError}
          >
            <span className="material-symbols-outlined text-[16px]">error</span>
            <span>Simulate Scan Error</span>
          </button>
          <button
            className="px-2.5 py-1.5 rounded-lg bg-surface-container-high text-secondary font-label-sm text-label-sm hover:bg-surface-container-highest transition-all flex items-center gap-1"
            onClick={handleSuccess}
          >
            <span className="material-symbols-outlined text-[16px]">check</span>
            <span>Simulate Clear Scan</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        <div className="lg:col-span-7 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col items-center justify-between relative min-h-[420px] overflow-hidden">
          <div className="w-full flex justify-between items-center text-xs font-mono text-on-surface-variant">
            <span>OPTICAL TUNNEL CAM #04</span>
            <span className="text-secondary font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-secondary"></span> 360 SCAN READY
            </span>
          </div>
          <div className="relative w-full max-w-lg aspect-video rounded-2xl bg-inverse-surface/90 flex items-center justify-center overflow-hidden my-4">
            <div className="absolute inset-0 flex flex-col justify-around pointer-events-none opacity-70" id="opticalLaser">
              <div className="w-full h-0.5 bg-secondary shadow-[0_0_8px_currentColor] animate-pulse"></div>
              <div className="w-full h-0.5 bg-primary shadow-[0_0_8px_currentColor]"></div>
              <div className="w-full h-0.5 bg-secondary shadow-[0_0_8px_currentColor] animate-pulse"></div>
            </div>
            <div className="relative z-10 flex flex-col items-center text-surface-container-lowest">
              <span className="material-symbols-outlined text-[120px] text-surface-variant/40">luggage</span>
              <div
                className={`absolute top-10 right-16 w-16 h-12 rounded flex items-center justify-center ${
                  isError
                    ? 'border-2 border-tertiary bg-tertiary/20 animate-bounce'
                    : 'border-2 border-secondary bg-secondary/10'
                }`}
                id="opticalReticle"
              >
                <span className={`material-symbols-outlined text-[18px] ${isError ? 'text-tertiary' : 'text-secondary'}`}>qr_code</span>
              </div>
            </div>
            <div className="absolute bottom-3 left-4 right-4 flex justify-between items-center text-[11px] font-mono text-surface-container-lowest">
              <span>RFID SIGNAL: -48 dBm (EXCELLENT)</span>
              <span>BARCODE DECODE: 100%</span>
            </div>
          </div>
          <div
            className={`w-full p-3 rounded-lg flex items-center justify-between ${isSuccess ? 'bg-secondary-container text-on-secondary-container' : 'bg-tertiary-fixed text-on-tertiary-fixed'} ${isError ? '' : 'hidden'}`}
            id="opticalErrorBanner"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary text-[22px]">error</span>
              <span className="font-label-md text-label-md font-bold">Tag Not Detected — Please Turn Tag Face Up</span>
            </div>
            <button
              className="px-3 py-1 rounded bg-tertiary text-on-tertiary font-label-sm text-label-sm"
              onClick={handleSuccess}
            >
              Retry Scan
            </button>
          </div>
          <div
            className={`w-full p-3 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-between ${isSuccess ? '' : 'hidden'}`}
            id="opticalStatusBanner"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[22px]">verified</span>
              <span className="font-label-md text-label-md font-bold">Tag Successfully Read and Verified</span>
            </div>
            <span className="font-label-sm text-label-sm">QR-082-992144-DOH</span>
          </div>
        </div>
        <div className="lg:col-span-5 space-y-space-md flex flex-col justify-between">
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm space-y-space-sm">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Conveyor Subsystem Telemetry</h2>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-surface-container-low">
                <span className="text-xs text-on-surface-variant font-label-sm text-label-sm block">Conveyor Motor Target</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-mono font-bold">1.20 m/s</span>
                <span className="text-[11px] text-secondary font-bold">• Synchronized</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-container-low">
                <span className="text-xs text-on-surface-variant font-label-sm text-label-sm block">Airlock Door</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-mono font-bold">ARMED</span>
                <span className="text-[11px] text-secondary font-bold">• Clear to Inject</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">SORTER ALLOCATION:</span>
                <span className="font-bold text-on-surface">CAROUSEL CHUTE #14 (DOH)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">FIRE SAFETY CURTAIN:</span>
                <span className="font-bold text-secondary">ACTIVE / CLEAR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">SAFETY JAM SENSOR:</span>
                <span className="font-bold text-secondary">UNOBSTRUCTED</span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <button
              className={`w-full h-20 rounded-2xl bg-secondary text-on-secondary font-headline-md text-headline-md shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 ${
                isError ? 'opacity-50 pointer-events-none' : ''
              }`}
              id="btnDispatch"
              onClick={handleDispatch}
              disabled={isError}
            >
              <span className="material-symbols-outlined text-[32px]">send</span>
              <span>DISPATCH BAG TO FLIGHT</span>
            </button>
            <p className="text-center font-body-md text-body-md text-on-surface-variant">
              Conveyor safety door will close once belt starts moving.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
