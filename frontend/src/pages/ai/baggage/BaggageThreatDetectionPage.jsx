import { useState, useRef, useEffect, useCallback } from 'react'
import Stepper from './components/Stepper'
import Step1 from './components/Step1'
import Step2 from './components/Step2'
import Step3 from './components/Step3'
import Step4 from './components/Step4'
import Step5 from './components/Step5'
import Step6 from './components/Step6'
import ManualBarcodeModal from './components/ManualBarcodeModal'
import Toast from './components/Toast'
import './BaggageThreatDetectionPage.css'

export default function BaggageThreatDetectionPage() {still
  const [currentStep, setCurrentStep] = useState(1)
  const [isOverweightSim, setIsOverweightSim] = useState(false)
  const [hasPaidExcessFee, setHasPaidExcessFee] = useState(false)
  const [bagCount, setBagCount] = useState(2)
  const [weight, setWeight] = useState(18.2)
  const [scanStatus, setScanStatus] = useState('success')
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const countdownTimer = useRef(null)
  const [secondsRemaining, setSecondsRemaining] = useState(30)

  const showToast = useCallback((msg) => {
    setToastMsg(msg)
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2800)
  }, [])

  const goToStep = useCallback((stepNumber) => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current)
      countdownTimer.current = null
    }
    setCurrentStep(stepNumber)
    if (stepNumber === 3) {
      setWeight(isOverweightSim ? 26.8 : 18.2)
    } else if (stepNumber === 6) {
      startAutoResetTimer()
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [isOverweightSim])

  const simulateFaceScan = useCallback(() => {
    showToast('Biometric scanning in progress...')
    setTimeout(() => {
      showToast('Face identity verified: 98.6% match.')
    }, 700)
  }, [showToast])

  const toggleWeightSim = useCallback(() => {
    setIsOverweightSim((prev) => {
      const next = !prev
      setHasPaidExcessFee(false)
      setWeight(next ? 26.8 : 18.2)
      showToast(`Simulation mode: ${next ? 'Luggage Overweight (26.8 kg)' : 'Standard Allowance (18.2 kg)'}`)
      return next
    })
  }, [showToast])

  const updateWeightDisplay = useCallback(() => {
    setWeight(isOverweightSim ? 26.8 : 18.2)
  }, [isOverweightSim])

  const selectBagCount = useCallback((count) => {
    setBagCount(count)
    showToast(`Checked bag count set to: ${count} bag${count > 1 ? 's' : ''}`)
  }, [showToast])

  const payExcessFee = useCallback(() => {
    setHasPaidExcessFee(true)
    showToast('Payment Approved: $45.00 via Contactless EMV. Weight Cleared!')
  }, [showToast])

  const repackLuggage = useCallback(() => {
    setIsOverweightSim(false)
    setHasPaidExcessFee(false)
    setWeight(18.2)
    showToast('Repack simulated: 8.6 kg removed. Weight now 18.2 kg.')
  }, [showToast])

  const reprintTag = useCallback(() => {
    showToast('Dispenser re-issuing thermal RFID tag...')
  }, [showToast])

  const simulateScanError = useCallback(() => {
    setScanStatus('error')
    showToast('Optical warning: Tag obscured or upside down.')
  }, [showToast])

  const simulateScanSuccess = useCallback(() => {
    setScanStatus('success')
    showToast('Optical Tunnel: Tag barcode and RFID match 100%.')
  }, [showToast])

  const dispatchLuggageToFlight = useCallback(() => {
    showToast('Airlock opened. Conveyor motor running at 1.2 m/s.')
    setTimeout(() => {
      goToStep(6)
    }, 900)
  }, [goToStep])

  const simulateManualBarcodePass = useCallback(() => {
    setModalOpen(false)
    showToast('Boarding Pass QR Scanned Successfully!')
    setTimeout(() => {
      goToStep(2)
    }, 400)
  }, [goToStep, showToast])

  const simulateSendReceipt = useCallback((channel) => {
    showToast(`Claim receipt pass sent via ${channel} to passenger phone.`)
  }, [showToast])

  const printPaperSlip = useCallback(() => {
    showToast('Thermal printer dispensing paper luggage claim slip.')
  }, [showToast])

  const resetFlow = useCallback(() => {
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current)
      countdownTimer.current = null
    }
    setIsOverweightSim(false)
    setHasPaidExcessFee(false)
    setBagCount(2)
    setWeight(18.2)
    setScanStatus('success')
    setCurrentStep(1)
    showToast('Kiosk session reset. Welcome, please look at the camera.')
  }, [showToast])

  const startAutoResetTimer = useCallback(() => {
    setSecondsRemaining(30)
    if (countdownTimer.current) clearInterval(countdownTimer.current)
    countdownTimer.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimer.current)
          resetFlow()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [resetFlow])

  useEffect(() => {
    return () => {
      if (countdownTimer.current) clearInterval(countdownTimer.current)
    }
  }, [])

  const completedSteps = new Array(currentStep - 1).fill(null).map((_, i) => i + 1)

  return (
    <main className="w-full bg-background text-on-surface antialiased selection:bg-primary selection:text-on-primary">
      <section className="w-full bg-surface-container-lowest shadow-sm sticky top-0 z-30 px-gutter py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0" id="stepperNav">
            <Stepper currentStep={currentStep} completedSteps={completedSteps} onStepClick={goToStep} />
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              className="px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface font-label-sm text-label-sm flex items-center gap-1.5 hover:bg-surface-container-highest transition-all shadow-sm"
              onClick={toggleWeightSim}
            >
              <span className="material-symbols-outlined text-[16px] text-tertiary">scale</span>
              <span id="weightToggleLabel">Sim: Overweight Off</span>
            </button>
            <button
              className="px-2.5 py-1 rounded-lg bg-surface-container-low text-tertiary font-label-sm text-label-sm flex items-center gap-1.5 hover:bg-error-container hover:text-on-error-container transition-all shadow-sm"
              onClick={resetFlow}
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>Reset Kiosk</span>
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-7xl w-full mx-auto px-gutter mt-space-md">
        <Step1 currentStep={currentStep} goToStep={goToStep} simulateFaceScan={simulateFaceScan} openManualBarcodeModal={() => setModalOpen(true)} />
        <Step2 currentStep={currentStep} bagCount={bagCount} selectBagCount={selectBagCount} goToStep={goToStep} />
        <Step3 currentStep={currentStep} isOverweightSim={isOverweightSim} hasPaidExcessFee={hasPaidExcessFee} weight={weight} toggleWeightSim={toggleWeightSim} payExcessFee={payExcessFee} repackLuggage={repackLuggage} goToStep={goToStep} />
        <Step4 currentStep={currentStep} weight={weight} bagCount={bagCount} reprintTag={reprintTag} goToStep={goToStep} />
        <Step5 currentStep={currentStep} scanStatus={scanStatus} simulateScanError={simulateScanError} simulateScanSuccess={simulateScanSuccess} dispatchLuggageToFlight={dispatchLuggageToFlight} goToStep={goToStep} />
        <Step6 currentStep={currentStep} weight={weight} bagCount={bagCount} secondsRemaining={secondsRemaining} simulateSendReceipt={simulateSendReceipt} printPaperSlip={printPaperSlip} resetFlow={resetFlow} goToStep={goToStep} />
      </div>

      <ManualBarcodeModal open={modalOpen} onClose={() => setModalOpen(false)} onConfirm={simulateManualBarcodePass} />
      <Toast visible={toastVisible} msg={toastMsg} />

      <footer className="w-full bg-surface-container-lowest/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40">
        <div className="w-full px-gutter py-3 flex flex-wrap items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></span>
              <span className="font-label-sm text-label-sm text-on-surface">Scale &amp; Optical Conveyor 04: <span className="font-bold text-secondary">ONLINE</span></span>
            </div>
            <div className="h-4 w-px bg-outline-variant"></div>
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
              <span className="font-label-sm text-label-sm">Optical Belt • Ready</span>
            </div>
            <div className="h-4 w-px bg-outline-variant"></div>
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span className="font-label-sm text-label-sm">RFID Tag Dispenser: 94%</span>
            </div>
          </div>
          <div className="flex items-center gap-space-sm">
            <button className="px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm flex items-center gap-1.5 hover:bg-surface-container-high hover:text-on-surface transition-all" type="button">
              <span className="material-symbols-outlined text-[16px]">volume_up</span>
              <span>Audio Guide</span>
            </button>
            <button className="px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm flex items-center gap-1.5 hover:bg-surface-container-high hover:text-on-surface transition-all" type="button">
              <span className="material-symbols-outlined text-[16px]">contrast</span>
              <span>High Contrast</span>
            </button>
            <button className="px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm flex items-center gap-1.5 hover:bg-surface-container-high hover:text-on-surface transition-all" type="button">
              <span className="material-symbols-outlined text-[16px]">help</span>
              <span>Help</span>
            </button>
          </div>
        </div>
      </footer>
    </main>
  )
}
