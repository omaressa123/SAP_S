import { useCallback } from 'react'

export default function Step2({ currentStep, bagCount, selectBagCount, goToStep }) {
  const handleSelect = useCallback(
    (count) => () => {
      selectBagCount(count)
    },
    [selectBagCount]
  )

  const handleBack = useCallback(() => {
    goToStep(1)
  }, [goToStep])

  const handleNext = useCallback(() => {
    goToStep(3)
  }, [goToStep])

  if (currentStep !== 2) return null

  const options = [
    { id: 1, label: '1 Bag', icon: 'luggage', count: 1, note: 'Single piece check-in. Standard allowance.', price: 'Included', weight: 'Up to 23.0 kg', priceLabel: 'Included' },
    {
      id: 2,
      label: '2 Bags',
      icon: 'luggage',
      count: 2,
      note: 'Both pieces covered under your ticket entitlement.',
      price: 'Complimentary',
      weight: '2 x 23.0 kg max',
      priceLabel: 'Full Quota',
      featured: true,
    },
    { id: 3, label: '3+ Bags', icon: 'add', count: 3, note: 'Additional baggage piece with airline excess charge.', price: '+$75 Extra Bag', weight: 'Payment at Kiosk', priceLabel: '+$75 Extra Bag' },
  ]

  return (
    <div className="step-content space-y-space-md hidden" id="step-2">
      <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[16px]">luggage</span>
            <span>Step 2 of 6 • Baggage Count &amp; Alignment</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Select Total Bags to Check-In Today</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">Your reservation includes 2 complimentary standard checked items up to 23 kg each.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-md text-label-md">Belt Scale: Zeroed (0.00 kg)</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
        {options.map((opt) => {
          const selected = bagCount === opt.id
          return (
            <div
              key={opt.id}
              className={`bag-card cursor-pointer p-space-md rounded-xl bg-surface-container-lowest hover:bg-surface-container-low transition-all shadow-sm space-y-space-sm ${
                selected ? 'bg-surface-container-low shadow-md ring-2 ring-primary' : ''
              }`}
              onClick={handleSelect(opt.id)}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-1">
                  {Array.from({ length: opt.count }).map((_, i) => (
                    <span key={i} className="material-symbols-outlined text-[36px] text-primary">
                      {opt.icon}
                    </span>
                  ))}
                  {opt.count === 3 && <span className="material-symbols-outlined text-[24px] text-on-surface-variant">add</span>}
                </div>
                <span className="w-6 h-6 rounded-full flex items-center justify-center check-mark">
                  {selected ? <span className="material-symbols-outlined text-[16px]">check</span> : null}
                </span>
              </div>
              <div>
                {opt.featured ? (
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline-sm text-headline-sm text-on-surface">{opt.label}</h2>
                    <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm">{opt.priceLabel}</span>
                  </div>
                ) : (
                  <h2 className="font-headline-sm text-headline-sm text-on-surface">{opt.label}</h2>
                )}
                <p className="font-body-md text-body-md text-on-surface-variant">{opt.note}</p>
              </div>
              <div className="pt-2 flex justify-between items-center text-sm font-label-sm text-label-sm">
                <span className={selected ? 'text-secondary font-bold' : 'text-tertiary font-bold'}>{opt.price}</span>
                <span className="text-on-surface-variant">{opt.weight}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="bg-surface-container-lowest p-space-lg rounded-xl shadow-sm">
        <div className="flex items-center gap-2 mb-space-md">
          <span className="material-symbols-outlined text-primary text-[28px]">conveyor_belt</span>
          <h2 className="font-headline-md text-headline-md text-on-surface">Physical Belt Placement Instructions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col items-center text-center space-y-3">
            <div className="w-20 h-20 rounded-2xl bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
              <span className="material-symbols-outlined text-[48px]">vertical_align_bottom</span>
            </div>
            <span className="font-label-md text-label-md text-on-surface font-bold">1. Upright Placement</span>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Place suitcase resting flat on its bottom wheels or base to ensure steady rolling.
            </p>
          </div>
          <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col items-center text-center space-y-3">
            <div className="w-20 h-20 rounded-2xl bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
              <span className="material-symbols-outlined text-[48px]">swap_horiz</span>
            </div>
            <span className="font-label-md text-label-md text-on-surface font-bold">2. Wheels Facing Rear</span>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Point main handle facing outward toward you, wheels facing backwards onto belt.
            </p>
          </div>
          <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col items-center text-center space-y-3">
            <div className="w-20 h-20 rounded-2xl bg-surface-container-lowest flex items-center justify-center text-tertiary shadow-sm">
              <span className="material-symbols-outlined text-[48px]">warning</span>
            </div>
            <span className="font-label-md text-label-md text-on-surface font-bold">3. Tuck Loose Straps</span>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Loose backpack strings and duffle handles must be secured to avoid conveyor jam.
            </p>
          </div>
        </div>
        <div className="mt-space-lg p-space-md rounded-xl bg-surface-container flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">scale</span>
            </div>
            <div>
              <span className="font-label-md text-label-md text-on-surface font-bold">Optical Belt Ready: Gate 04 Scale Cleared</span>
              <p className="font-body-md text-body-md text-on-surface-variant">Please place your first luggage item onto the rubber track now.</p>
            </div>
          </div>
          <div className="font-mono text-headline-sm text-headline-sm text-primary font-bold">0.00 kg</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-space-md">
        <button
          className="h-14 px-space-lg rounded-xl bg-surface-container-low text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-all flex items-center gap-2"
          onClick={handleBack}
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          <span>Back to Passenger ID</span>
        </button>
        <button
          className="h-16 px-space-xl rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-md hover:bg-primary-container active:scale-95 transition-all flex items-center gap-2"
          onClick={handleNext}
        >
          <span>Bag Placed on Belt — Start Weighing</span>
          <span className="material-symbols-outlined text-[24px]">scale</span>
        </button>
      </div>
    </div>
  )
}
