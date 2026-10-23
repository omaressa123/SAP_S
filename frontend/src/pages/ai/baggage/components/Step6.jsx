import { useCallback, useEffect, useRef, useState } from 'react'

export default function Step6({
  currentStep,
  weight,
  bagCount,
  secondsRemaining,
  simulateSendReceipt,
  printPaperSlip,
  resetFlow,
  goToStep,
}) {
  const countdownTimer = useRef(null)
  const [count, setCount] = useState(secondsRemaining)

  const handleSms = useCallback(() => {
    simulateSendReceipt('SMS')
  }, [simulateSendReceipt])

  const handleWallet = useCallback(() => {
    simulateSendReceipt('Wallet')
  }, [simulateSendReceipt])

  const handlePrint = useCallback(() => {
    printPaperSlip()
  }, [printPaperSlip])

  const handleReset = useCallback(() => {
    resetFlow()
  }, [resetFlow])

  const tagWeightLabel = `${weight.toFixed(1)} KG / BAG 1 OF 2`

  useEffect(() => {
    if (currentStep !== 6) return
    setCount(secondsRemaining)
    if (countdownTimer.current) clearInterval(countdownTimer.current)
    countdownTimer.current = setInterval(() => {
      setCount((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimer.current)
          handleReset()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current)
    }
  }, [currentStep, secondsRemaining, handleReset])

  if (currentStep !== 6) return null

  return (
    <div className="step-content space-y-space-md hidden" id="step-6">
      <div className="bg-secondary-container text-on-secondary-container p-space-lg rounded-2xl shadow-sm text-center space-y-space-xs">
        <div className="w-16 h-16 rounded-full bg-secondary text-on-secondary mx-auto flex items-center justify-center shadow-md">
          <span className="material-symbols-outlined text-[36px]">task_alt</span>
        </div>
        <h1 className="font-display-md text-display-md font-bold tracking-tight">All Set! Baggage Checked In</h1>
        <p className="font-body-xl text-body-xl max-w-2xl mx-auto">
          Your baggage is on its way through sorting to Flight QR-082. You may proceed through passport control and security.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        <div className="lg:col-span-7 bg-surface-container-lowest p-space-lg rounded-xl shadow-sm space-y-space-md">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
            <div>
              <span className="font-headline-sm text-headline-sm text-on-surface">Luggage Claim Receipts</span>
              <span className="font-body-md text-body-md text-on-surface-variant block">Booking Reference: <strong className="text-primary font-mono">QR-9Y8K2X</strong></span>
            </div>
            <span className="px-3 py-1 rounded bg-surface-container text-primary font-label-md text-label-md font-mono">2 Bags Handled</span>
          </div>
          <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                <span className="material-symbols-outlined text-[28px]">luggage</span>
              </div>
              <div>
                <span className="font-label-md text-label-md text-on-surface font-bold">Bag 1 • QR-082-992144</span>
                <span className="text-xs text-on-surface-variant block" id="finalBag1Weight">
                  Gross Weight: {weight.toFixed(1)} kg • Standard Compliant
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-bold">Accepted</span>
          </div>
          <div className="p-space-md rounded-xl bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                <span className="material-symbols-outlined text-[28px]">luggage</span>
              </div>
              <div>
                <span className="font-label-md text-label-md text-on-surface font-bold">Bag 2 • QR-082-992145</span>
                <span className="text-xs text-on-surface-variant block">Gross Weight: 19.4 kg • Standard Compliant</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-bold">Accepted</span>
          </div>
          <div className="p-3 rounded-lg bg-surface-container text-xs text-on-surface space-y-1">
            <span className="font-bold block">Arrival Carousel:</span>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Collect your luggage at Doha Hamad International Airport (DOH) • Baggage Claim Hall Carousel #08 upon landing.
            </p>
          </div>
        </div>
        <div className="lg:col-span-5 space-y-space-md">
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm space-y-space-sm">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block">Your Next Step</span>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-headline-lg text-headline-lg text-primary font-bold">Gate B22</span>
                <span className="font-body-md text-body-md text-on-surface block">Concourse B • Level 2</span>
              </div>
              <div className="text-right">
                <span className="font-label-sm text-label-sm text-secondary font-bold block">Security: Light</span>
                <span className="font-label-md text-label-md text-on-surface">~7-9 min walk</span>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low flex items-center gap-2.5 text-xs text-on-surface">
              <span className="material-symbols-outlined text-primary text-[20px]">schedule</span>
              <span>Gate opens at <strong>14:15</strong>. Boarding begins in 45 minutes.</span>
            </div>
          </div>
          <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm space-y-3">
            <span className="font-label-sm text-label-sm text-on-surface-variant block">Save Your Baggage Claim Receipts</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                className="px-3 py-3 rounded-lg bg-surface-container-low text-on-surface font-label-sm text-label-sm hover:bg-surface-container-high transition-all flex items-center justify-center gap-2 shadow-sm"
                onClick={handleSms}
              >
                <span className="material-symbols-outlined text-[18px] text-primary">sms</span>
                <span>Send to SMS</span>
              </button>
              <button
                className="px-3 py-3 rounded-lg bg-surface-container-low text-on-surface font-label-sm text-label-sm hover:bg-surface-container-high transition-all flex items-center justify-center gap-2 shadow-sm"
                onClick={handleWallet}
              >
                <span className="material-symbols-outlined text-[18px] text-primary">wallet</span>
                <span>Apple/Google Pass</span>
              </button>
            </div>
            <button
              className="w-full py-3 rounded-lg bg-surface-container text-on-surface font-label-sm text-label-sm hover:bg-surface-container-high transition-all flex items-center justify-center gap-2"
              onClick={handlePrint}
            >
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
              <span>Print Physical Paper Receipt Slip</span>
            </button>
          </div>
          <div className="p-space-md rounded-xl bg-surface-container-low flex items-center justify-between">
            <div className="text-xs text-on-surface-variant">
              <span>Station will reset in:</span>
              <span className="font-bold text-on-surface block font-mono text-sm" id="resetCountdown">
                {count} seconds
              </span>
            </div>
            <button
              className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-sm text-label-sm hover:bg-primary-container transition-all"
              onClick={handleReset}
            >
              Start New Check-In
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
