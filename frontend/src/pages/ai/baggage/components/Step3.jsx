import { useCallback } from 'react'

export default function Step3({
  currentStep,
  isOverweightSim,
  hasPaidExcessFee,
  weight,
  toggleWeightSim,
  payExcessFee,
  repackLuggage,
  goToStep,
}) {
  const handleBack = useCallback(() => {
    goToStep(2)
  }, [goToStep])

  const handleProceedTag = useCallback(() => {
    goToStep(4)
  }, [goToStep])

  const handleToggle = useCallback(() => {
    toggleWeightSim()
  }, [toggleWeightSim])

  const handlePay = useCallback(() => {
    payExcessFee()
  }, [payExcessFee])

  const handleRepack = useCallback(() => {
    repackLuggage()
  }, [repackLuggage])

  if (currentStep !== 3) return null

  const displayWt = weight.toFixed(1)
  const progressPct = isOverweightSim ? 96 : 79
  const isOverweight = isOverweightSim && !hasPaidExcessFee
  const barColor = isOverweight ? 'bg-tertiary' : 'bg-secondary'

  return (
    <div className="step-content space-y-space-md hidden" id="step-3">
      <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[16px]">monitor_weight</span>
            <span>Step 3 of 6 • Dynamic Weighing &amp; Volumetric Scan</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">3D Dimension &amp; Scale Analysis</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Laser rangefinders and integrated piezoelectric floor sensors analyze load integrity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface font-label-sm text-label-sm hover:bg-surface-container-highest transition-all flex items-center gap-1.5"
            onClick={handleToggle}
          >
            <span className="material-symbols-outlined text-[18px]">tune</span>
            <span>Toggle Standard / Overweight</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        <div className="lg:col-span-7 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col items-center justify-between relative min-h-[420px]">
          <div className="w-full flex justify-between items-center text-xs font-mono text-on-surface-variant">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-secondary"></span> 3D LIDAR: ACTIVE</span>
            <span>VOXEL RESOLUTION: 4MM</span>
          </div>
          <div className="relative my-8 flex items-center justify-center">
            <div className="relative w-64 h-72 rounded-2xl bg-surface-container-highest shadow-xl flex flex-col items-center justify-center p-4">
              <div className="w-48 h-56 rounded-xl bg-primary-container/20 flex flex-col items-center justify-between p-3 relative">
                <div className="w-16 h-4 rounded-t-md bg-outline-variant -mt-5"></div>
                <div className="w-full space-y-2">
                  <div className="w-full h-1 bg-primary/20 rounded"></div>
                  <div className="w-full h-1 bg-primary/20 rounded"></div>
                  <div className="w-full h-1 bg-primary/20 rounded"></div>
                </div>
                <div className="flex justify-between w-full px-2 -mb-5">
                  <div className="w-4 h-4 rounded-full bg-inverse-surface"></div>
                  <div className="w-4 h-4 rounded-full bg-inverse-surface"></div>
                </div>
              </div>
              <div className="absolute -top-3 left-4 px-2 py-0.5 rounded bg-surface-container-lowest shadow text-[11px] font-mono font-bold text-primary">Length: 72 cm</div>
              <div className="absolute top-1/2 -right-8 -translate-y-1/2 px-2 py-0.5 rounded bg-surface-container-lowest shadow text-[11px] font-mono font-bold text-primary" style={{ writingMode: 'vertical-rl' }}>
                Height: 48 cm
              </div>
              <div className="absolute -bottom-3 right-4 px-2 py-0.5 rounded bg-surface-container-lowest shadow text-[11px] font-mono font-bold text-primary">Width: 28 cm</div>
            </div>
            <div className="w-full p-3 rounded-lg bg-surface-container-low flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[20px]">check_circle</span>
                <span className="font-label-sm text-label-sm text-on-surface">
                  Dimensions: <span className="font-bold">72 × 48 × 28 cm</span> (Linear Total: 148 cm ≤ 158 cm Max)
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">Standard Size Compliant</span>
            </div>
          </div>
        </div>
        <div className="lg:col-span-5 space-y-space-md flex flex-col justify-between">
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm space-y-space-sm">
            <span className="font-label-sm text-label-sm text-on-surface-variant block uppercase tracking-wider">Belt Scale Gross Weight</span>
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="font-display-lg text-display-lg text-on-surface font-extrabold tracking-tight" id="displayWeightVal">
                  {displayWt}
                </span>
                <span className="font-headline-md text-headline-md text-on-surface-variant">kg</span>
              </div>
              <div className="text-right">
                <span className="font-label-sm text-label-sm text-on-surface-variant block">Allowance</span>
                <span className="font-headline-sm text-headline-sm text-primary font-bold">23.0 kg</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="w-full h-3 rounded-full bg-surface-container-high overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all duration-500`} id="weightProgressBar" style={{ width: `${progressPct}%` }}></div>
              </div>
              <div className="flex justify-between text-xs text-on-surface-variant font-mono">
                <span>0 kg</span>
                <span>23 kg (Max Free)</span>
                <span>32 kg (Heavy Max)</span>
              </div>
            </div>
            <div
              className={`p-space-md rounded-xl bg-tertiary-fixed text-on-tertiary-fixed space-y-2 ${isOverweight ? '' : 'hidden'}`}
              id="overweightAlert"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px] text-tertiary">warning</span>
                <span className="font-headline-sm text-headline-sm font-bold text-tertiary">Luggage Exceeds Allowance (+3.8 kg)</span>
              </div>
              <p className="font-body-md text-body-md text-on-tertiary-fixed">
                Current weight is 26.8 kg. Your complimentary limit is 23.0 kg. To clear this bag onto the flight, settle the airline excess weight fee.
              </p>
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  className="px-3 py-3 rounded-lg bg-tertiary text-on-tertiary font-label-md text-label-md flex items-center justify-center gap-2 hover:bg-tertiary-container shadow-sm active:scale-95 transition-all"
                  id="payFeeBtn"
                  onClick={handlePay}
                  disabled={hasPaidExcessFee}
                >
                  <span className="material-symbols-outlined text-[18px]">contactless</span>
                  <span>Pay Surcharge $45.00</span>
                </button>
                <button
                  className="px-3 py-3 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-label-md hover:bg-surface-container-low transition-all"
                  onClick={handleRepack}
                >
                  <span>Repack / Remove Items</span>
                </button>
              </div>
            </div>
            <div
              className={`p-3 rounded-lg bg-secondary-container text-on-secondary-container flex items-center gap-2.5 ${!isOverweight ? '' : 'hidden'}`}
              id="clearedWeightBadge"
            >
              <span className="material-symbols-outlined text-[22px] text-secondary">check_circle</span>
              <div>
                <span className="font-label-md text-label-md font-bold block">Weight Approved for Dispatch</span>
                <span className="font-body-md text-body-md">
                  Item #1 is within your 23.0 kg allowance. RFID tag ready.
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              className="h-14 px-space-md rounded-xl bg-surface-container-low text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-all"
              onClick={handleBack}
            >
              <span>Back</span>
            </button>
            <button
              className={`flex-1 h-16 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-md hover:bg-primary-container active:scale-95 transition-all flex items-center justify-center gap-2 ${
                isOverweight ? 'opacity-50 pointer-events-none' : ''
              }`}
              id="btnProceedTag"
              onClick={handleProceedTag}
              disabled={isOverweight}
            >
              <span>Accept &amp; Proceed to Tag Printing</span>
              <span className="material-symbols-outlined text-[24px]">print</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
