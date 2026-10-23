import { useCallback } from 'react'

export default function Step4({ currentStep, weight, bagCount, reprintTag, goToStep }) {
  const handleBack = useCallback(() => {
    goToStep(3)
  }, [goToStep])

  const handleReprint = useCallback(() => {
    reprintTag()
  }, [reprintTag])

  const handleNext = useCallback(() => {
    goToStep(5)
  }, [goToStep])

  const tagWeightLabel = `${weight.toFixed(1)} KG / BAG 1 OF 2`

  if (currentStep !== 4) return null

  return (
    <div className="step-content space-y-space-md hidden" id="step-4">
      <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-space-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm">
            <span className="material-symbols-outlined text-[16px]">print</span>
            <span>Step 4 of 6 • Tag Generation &amp; Physical Attachment</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Collect and Attach Your Luggage Tag</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">The thermal dispenser has produced your airline RFID tracking loop below.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">sensors</span>
            <span>RFID Inlay Encoded (EPC Gen2)</span>
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
        <div className="lg:col-span-6 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm flex flex-col items-center space-y-space-md">
          <span className="font-label-md text-label-md text-on-surface font-bold uppercase tracking-wider">Printed Bag Tag Representation</span>
          <div className="w-full max-w-sm rounded-2xl bg-surface-container-lowest p-4 shadow-xl border-2 border-dashed border-outline-variant space-y-3 font-mono">
            <div className="flex justify-between items-center pb-2 border-b border-outline-variant">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg text-primary">QATAR</span>
                <span className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded">QR 082</span>
              </div>
              <span className="text-xs font-bold text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">nfc</span> RFID ACTIVE
              </span>
            </div>
            <div className="text-center py-2">
              <span className="text-xs uppercase text-on-surface-variant block tracking-widest">Final Destination</span>
              <span className="text-5xl font-black text-on-surface tracking-tighter">DOH</span>
              <span className="text-xs text-on-surface-variant block mt-0.5">Doha Hamad International</span>
            </div>
            <div className="text-xs space-y-1 pt-1 border-t border-outline-variant">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">PASSENGER:</span>
                <span className="font-bold text-on-surface">DOE / JOHNATHAN MR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">FLIGHT / DATE:</span>
                <span className="font-bold text-on-surface">QR 082 / TODAY</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">WEIGHT / PIECE:</span>
                <span className="font-bold text-primary" id="tagWeightLabel">
                  {tagWeightLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">TAG NUMBER:</span>
                <span className="font-bold text-on-surface">QR-082-992144-DOH</span>
              </div>
            </div>
            <div className="pt-3 flex flex-col items-center">
              <div className="w-full h-12 bg-on-surface flex items-center justify-between px-2 text-[9px] text-surface font-mono tracking-widest overflow-hidden">
                || | |||| | ||| |||| | | |||| | || |||| | | |||| || | |||| ||
              </div>
              <span className="text-[10px] text-on-surface-variant mt-1 tracking-widest">0 157 082992144 9</span>
            </div>
          </div>
          <div className="w-full p-4 rounded-xl bg-surface-container flex items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-[28px]">arrow_downward</span>
              <span className="font-label-md text-label-md text-on-surface font-bold">Collect Tag from Dispenser Below</span>
            </div>
            <button
              className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-sm text-label-sm hover:bg-surface-container-high transition-all flex items-center gap-1 shadow-sm"
              onClick={handleReprint}
            >
              <span className="material-symbols-outlined text-[16px]">replay</span>
              <span>Reprint Tag</span>
            </button>
          </div>
        </div>
        <div className="lg:col-span-6 space-y-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm space-y-space-md">
            <h2 className="font-headline-md text-headline-md text-on-surface">How to Fasten the Tag to Your Luggage</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-3 rounded-lg bg-surface-container-low">
                <div className="w-8 h-8 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center shrink-0">1</div>
                <div className="space-y-1">
                  <span className="font-label-md text-label-md text-on-surface font-bold">Peel Backing Paper</span>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Peel the adhesive backing film from the ends. Keep the passenger claim receipt tab intact.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 rounded-lg bg-surface-container-low">
                <div className="w-8 h-8 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center shrink-0">2</div>
                <div className="space-y-1">
                  <span className="font-label-md text-label-md text-on-surface font-bold">Loop Through Top Handle</span>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Thread the strap around the rigid top carry handle. Avoid attaching to wheels or extending poles.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4 p-3 rounded-lg bg-surface-container-low">
                <div className="w-8 h-8 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center shrink-0">3</div>
                <div className="space-y-1">
                  <span className="font-label-md text-label-md text-on-surface font-bold">Press Ends Firmly Together</span>
                  <p className="font-body-md text-body-md text-on-surface-variant">
                    Join both adhesive tabs end-to-end. Press firmly for 2 seconds to form a tamper-evident seal.
                  </p>
                </div>
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
              className="flex-1 h-16 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg shadow-md hover:bg-primary-container active:scale-95 transition-all flex items-center justify-center gap-2"
              onClick={handleNext}
            >
              <span>I Have Attached the Tag — Scan &amp; Verify</span>
              <span className="material-symbols-outlined text-[24px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
