import React, { useState, useEffect, useRef } from 'react'
import { BaggageDropApi } from '../services/api'

export default function BaggageDrop() {
  const [currentStep, setCurrentStep] = useState(1)
  const [currentLang, setCurrentLang] = useState('EN')
  const [bagCount, setBagCount] = useState(2)
  const [isOverweightSim, setIsOverweightSim] = useState(false)
  const [hasPaidExcessFee, setHasPaidExcessFee] = useState(false)
  const [isManualModalOpen, setIsManualModalOpen] = useState(false)
  const [scanStatus, setScanStatus] = useState('success') // 'success' | 'error'
  const [toastMessage, setToastMessage] = useState(null)
  const [secondsRemaining, setSecondsRemaining] = useState(30)
  const [loading, setLoading] = useState(false)

  // Biometric Identification State (Initially Unverified)
  const [isIdentified, setIsIdentified] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [webcamActive, setWebcamActive] = useState(false)
  const [webcamError, setWebcamError] = useState(null)
  const [uploadedFacePreview, setUploadedFacePreview] = useState(null)
  const [manifestList, setManifestList] = useState([])
  const [manualBarcodeInput, setManualBarcodeInput] = useState('')

  // Live passenger state linked to PostgreSQL
  const [passenger, setPassenger] = useState(null)

  // Default Flight Info (for pre-identification display)
  const defaultFlight = {
    flightNumber: 'QR-082',
    destinationIata: 'DOH',
    destinationName: 'Doha Hamad Intl',
    airline: 'Qatar Airways • Boeing 777-300ER',
    gate: 'Gate B22 • Zone 2',
    boardingTime: '14:15'
  }

  // Issued baggage tags
  const [tagData, setTagData] = useState({
    bagId: 901,
    tagNumber: 'QR-082-992144-DOH',
    rfidTag: 'RFQR0820051992144',
    weightKg: 18.2,
    linearDimensionsCm: 148.0,
    sorterAllocation: 'Carousel Chute #14 (DOH)'
  })

  // Refs
  const timerRef = useRef(null)
  const toastTimeoutRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  const showToast = (msg) => {
    setToastMessage(msg)
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null)
    }, 2800)
  }

  // Webcam Management
  const startWebcam = async () => {
    setWebcamError(null)
    setUploadedFacePreview(null)

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setWebcamError('Camera API not accessible. You can upload a face photo or scan your boarding pass.')
      return
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(tr => tr.stop())
      }

      let stream = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }

      streamRef.current = stream
      setWebcamActive(true)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
      }
    } catch (err) {
      console.warn('Webcam start error:', err)
      setWebcamError('Camera unavailable or permission denied. Please allow camera access or use photo upload.')
      setWebcamActive(false)
    }
  }

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(tr => tr.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setWebcamActive(false)
  }

  // Load manifest passengers on mount for manual boarding pass option
  useEffect(() => {
    const loadManifest = async () => {
      try {
        const res = await BaggageDropApi.getManifestPassengers('QR-082')
        if (res && Array.isArray(res)) {
          setManifestList(res)
        }
      } catch (err) {
        console.warn('Could not load manifest list', err)
      }
    }
    loadManifest()

    // Start camera if on Step 1
    if (currentStep === 1) {
      startWebcam()
    }

    return () => {
      stopWebcam()
      if (timerRef.current) clearInterval(timerRef.current)
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    }
  }, [])

  // Auto-manage webcam on step changes
  useEffect(() => {
    if (currentStep === 1 && !uploadedFacePreview) {
      startWebcam()
    } else if (currentStep !== 1) {
      stopWebcam()
    }
  }, [currentStep])

  // Auto-reset countdown for Step 6
  useEffect(() => {
    if (currentStep === 6) {
      setSecondsRemaining(30)
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            resetFlow()
            return 30
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [currentStep])

  const goToStep = (stepNumber) => {
    setCurrentStep(stepNumber)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetFlow = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setIsOverweightSim(false)
    setHasPaidExcessFee(false)
    setBagCount(2)
    setScanStatus('success')
    setIsIdentified(false)
    setPassenger(null)
    setScanError(null)
    setUploadedFacePreview(null)
    setCurrentStep(1)
    startWebcam()
    showToast('Kiosk session reset. Please scan your face or boarding pass.')
  }

  // Frame Capture from Canvas
  const captureFrame = () => {
    if (uploadedFacePreview) return uploadedFacePreview
    if (!videoRef.current || !webcamActive) return ''
    try {
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/jpeg', 0.85)
    } catch {
      return ''
    }
  }

  // Real Biometric Face Verification Check
  const handleFaceScan = async () => {
    setLoading(true)
    setScanError(null)

    const frame = captureFrame()
    if (!frame) {
      setScanError('Camera is offline. Please click "Turn on Live Camera" or "Upload Test Photo" to verify identity.')
      setLoading(false)
      return
    }

    showToast('Scanning face biometric and matching against Flight QR-082 manifest...')
    try {
      const res = await BaggageDropApi.identifyPassenger({
        capturedFrameBase64: frame,
        flightNumber: 'QR-082'
      })

      if (res && res.identified) {
        setIsIdentified(true)
        setPassenger(res)
        setScanError(null)
        showToast(`Biometric Confirmed: ${res.fullName} (${res.matchConfidence}% match).`)
      } else {
        setIsIdentified(false)
        setScanError(res?.message || 'Biometric match failed: Face does not match registered passenger for Flight QR-082.')
      }
    } catch (err) {
      console.warn('Biometric API error:', err)
      setScanError(err.message || 'Biometric identification service error. Please try again or scan boarding pass.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Photo Upload (for testing or bypass)
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      stopWebcam()
      setScanError(null)
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64Data = ev.target.result
        setUploadedFacePreview(base64Data)
        // Automatically verify
        setLoading(true)
        showToast('Processing uploaded photo biometrics...')
        try {
          const res = await BaggageDropApi.identifyPassenger({
            capturedFrameBase64: base64Data,
            flightNumber: 'QR-082'
          })
          if (res && res.identified) {
            setIsIdentified(true)
            setPassenger(res)
            setScanError(null)
            showToast(`Biometric Confirmed: ${res.fullName} (${res.matchConfidence}% match).`)
          } else {
            setIsIdentified(false)
            setScanError(res?.message || 'Uploaded photo did not match registered manifest for Flight QR-082.')
          }
        } catch (err) {
          setScanError(err.message || 'Error processing uploaded photo.')
        } finally {
          setLoading(false)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  // Handle Manual Boarding Pass Verification
  const handleBoardingPassScan = async (barcode) => {
    if (!barcode) return
    setLoading(true)
    setScanError(null)
    showToast('Validating boarding pass barcode with database...')
    try {
      const res = await BaggageDropApi.identifyPassenger({
        barcode: barcode.trim(),
        flightNumber: 'QR-082'
      })
      if (res && res.identified) {
        setIsIdentified(true)
        setPassenger(res)
        setIsManualModalOpen(false)
        setScanError(null)
        showToast(`Boarding Pass Verified: ${res.fullName}. Identity cleared!`)
      } else {
        showToast(res?.message || 'Invalid boarding pass code. Passenger not found.')
      }
    } catch (err) {
      showToast(err.message || 'Failed to verify boarding pass.')
    } finally {
      setLoading(false)
    }
  }

  const toggleWeightSim = () => {
    const nextSim = !isOverweightSim
    setIsOverweightSim(nextSim)
    setHasPaidExcessFee(false)
    showToast(`Simulation mode: ${nextSim ? 'Luggage Overweight (26.8 kg)' : 'Standard Allowance (18.2 kg)'}`)
  }

  const currentWeightVal = isOverweightSim ? '26.8' : '18.2'
  const isCurrentlyOverweight = isOverweightSim && !hasPaidExcessFee

  const payExcessFee = async () => {
    setLoading(true)
    try {
      await BaggageDropApi.weighBag({
        passengerId: passenger?.passengerId || 5,
        weightKg: 26.8,
        feePaid: true
      })
      setHasPaidExcessFee(true)
      showToast('Payment Approved: $45.00 via Contactless EMV. Weight Cleared!')
    } catch {
      setHasPaidExcessFee(true)
      showToast('Payment Approved: $45.00 via Contactless EMV. Weight Cleared!')
    } finally {
      setLoading(false)
    }
  }

  const repackLuggage = () => {
    setIsOverweightSim(false)
    setHasPaidExcessFee(false)
    showToast('Repack simulated: 8.6 kg removed. Weight now 18.2 kg.')
  }

  const handleProceedToTag = async () => {
    setLoading(true)
    try {
      const res = await BaggageDropApi.issueTag({
        passengerId: passenger?.passengerId || 5,
        bookingId: passenger?.bookingId || 1,
        weightKg: parseFloat(currentWeightVal),
        bagIndex: 1,
        totalBags: bagCount
      })
      if (res) {
        setTagData(prev => ({
          ...prev,
          bagId: res.bagId,
          tagNumber: res.tagNumber,
          rfidTag: res.rfidTag,
          weightKg: res.weightKg
        }))
      }
    } catch (err) {
      console.warn('Issue tag API fallback:', err)
    } finally {
      setLoading(false)
      goToStep(4)
    }
  }

  const dispatchLuggageToFlight = async () => {
    setLoading(true)
    showToast('Airlock opened. Conveyor motor running at 1.2 m/s.')
    try {
      const res = await BaggageDropApi.dispatchBag({
        passengerId: passenger?.passengerId || 5,
        bagId: tagData.bagId,
        tagNumber: tagData.tagNumber
      })
      if (res && res.sorterAllocation) {
        setTagData(prev => ({ ...prev, sorterAllocation: res.sorterAllocation }))
      }
    } catch (err) {
      console.warn('Dispatch API fallback:', err)
    } finally {
      setTimeout(() => {
        setLoading(false)
        goToStep(6)
      }, 800)
    }
  }

  return (
    <div className="bg-background font-body-md text-body-md text-on-surface min-h-screen flex flex-col justify-between selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Station Sub-Header & Breadcrumb */}
      <header className="sticky top-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-20 w-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[26px]">luggage</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-headline-sm text-primary tracking-tight font-bold">AeroGate</span>
                <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm uppercase tracking-wide font-bold">
                  Self-Drop #04
                </span>
              </div>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                Terminal 2 • International Departures • SkyWay Alliance
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Language Selector */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-container-low">
              {['EN', 'ES', 'FR', 'AR'].map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setCurrentLang(lang)}
                  className={`px-3 py-1.5 rounded-lg font-label-md text-label-md transition-all ${
                    currentLang === lang
                      ? 'bg-surface-container-lowest text-on-surface font-bold shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>

            {/* Assistance Button */}
            <button
              type="button"
              onClick={() => showToast('Station agent alerted. An attendant is arriving at Self-Drop #04.')}
              className="h-12 px-4 rounded-xl bg-surface-container-lowest text-tertiary font-label-md text-label-md flex items-center gap-2 shadow-[0_1px_8px_rgba(0,0,0,0.06)] hover:bg-error-container hover:text-on-error-container transition-all active:scale-95"
            >
              <span className="material-symbols-outlined text-[20px]">support_agent</span>
              <span>Call Assistance</span>
            </button>

            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
            </div>
          </div>
        </div>

        {/* Stepper Bar & Simulator Controls */}
        <div className="w-full bg-surface-container-lowest border-t border-outline-variant/30 px-6 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {[
              { num: 1, label: 'Face ID' },
              { num: 2, label: 'Bag Count' },
              { num: 3, label: 'Weigh & Scale' },
              { num: 4, label: 'Print & Tag' },
              { num: 5, label: 'Optical Verify' },
              { num: 6, label: 'Complete' }
            ].map(step => {
              const isActive = currentStep === step.num
              const isPassed = currentStep > step.num
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => goToStep(step.num)}
                  className={`px-3 py-1.5 rounded-lg font-label-sm text-label-sm flex items-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-primary text-on-primary font-bold shadow-sm'
                      : isPassed
                      ? 'bg-secondary-fixed text-on-secondary-fixed font-bold'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                      isActive
                        ? 'bg-surface-container-lowest text-primary'
                        : isPassed
                        ? 'bg-secondary text-on-secondary'
                        : 'bg-surface-variant text-on-surface'
                    }`}
                  >
                    {step.num}
                  </span>
                  <span>{step.label}</span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              type="button"
              onClick={toggleWeightSim}
              className={`px-2.5 py-1 rounded-lg font-label-sm text-label-sm flex items-center gap-1.5 transition-all shadow-sm ${
                isOverweightSim
                  ? 'bg-tertiary text-on-tertiary font-bold'
                  : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">scale</span>
              <span>{isOverweightSim ? 'Sim: Overweight ON (26.8kg)' : 'Sim: Overweight Off'}</span>
            </button>
            <button
              type="button"
              onClick={resetFlow}
              className="px-2.5 py-1 rounded-lg bg-surface-container-low text-tertiary font-label-sm text-label-sm flex items-center gap-1.5 hover:bg-error-container hover:text-on-error-container transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>Reset Kiosk</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full flex-1 flex flex-col px-6 py-6 max-w-7xl mx-auto pb-24">
        {/* ========================================================================= */}
        {/* STEP 1: Biometric Face ID & Passenger Identity Verification               */}
        {/* ========================================================================= */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm font-semibold">
                  <span className="material-symbols-outlined text-[16px]">fingerprint</span>
                  <span>Step 1 of 6 • Identity Verification</span>
                </div>
                <h1 className="font-headline-lg text-2xl md:text-3xl font-bold text-on-surface">Please Look Directly at the Camera</h1>
                <p className="font-body-md text-on-surface-variant">
                  Align your face within the biometric oval or scan your flight boarding pass to retrieve your reservation.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-3 py-2 rounded-lg bg-surface-container text-primary font-label-md text-label-md flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${webcamActive ? 'bg-secondary animate-pulse' : 'bg-outline'}`}></span>
                  <span className="font-semibold">{webcamActive ? 'Camera 01 • Active HD' : 'Camera Ready'}</span>
                </div>
              </div>
            </div>

            {/* Error / Alert Banners */}
            {scanError && (
              <div className="p-4 rounded-xl bg-error-container text-on-error-container flex items-start justify-between gap-3 shadow-sm animate-fade-in">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[24px] text-error shrink-0">error</span>
                  <div>
                    <span className="font-label-md font-bold block">Biometric Scan Mismatch</span>
                    <p className="text-sm">{scanError}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-sm text-xs font-bold hover:bg-surface-container-low shrink-0"
                >
                  Use Boarding Pass
                </button>
              </div>
            )}

            {webcamError && !uploadedFacePreview && (
              <div className="p-3.5 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-tertiary">videocam_off</span>
                  <span>{webcamError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1 rounded-lg bg-primary text-on-primary font-label-sm text-xs font-bold shrink-0"
                >
                  Upload Photo
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Viewfinder */}
              <div className="lg:col-span-7 bg-surface-container-lowest p-8 rounded-xl shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl bg-surface-container-high overflow-hidden flex items-center justify-center shadow-inner">
                  {/* Live Video Feed or Uploaded Face Preview */}
                  {uploadedFacePreview ? (
                    <img
                      src={uploadedFacePreview}
                      alt="Uploaded traveler face"
                      className="w-full h-full object-cover"
                    />
                  ) : webcamActive ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-surface-container to-primary/20 flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[120px] text-primary/30">person</span>
                      <button
                        type="button"
                        onClick={startWebcam}
                        className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-sm text-xs font-bold shadow"
                      >
                        Turn On Camera
                      </button>
                    </div>
                  )}

                  {/* Biometric Oval Reticle */}
                  <div
                    className={`absolute z-10 w-44 h-60 rounded-[48%] border-2 flex flex-col items-center justify-between py-6 transition-all duration-500 ${
                      isIdentified
                        ? 'border-secondary ring-4 ring-secondary/30 shadow-[0_0_20px_rgba(0,108,73,0.4)]'
                        : 'border-primary border-dashed'
                    }`}
                  >
                    <div className={`w-8 h-1 rounded-full ${isIdentified ? 'bg-secondary' : 'bg-primary'}`}></div>
                    {!isIdentified && (
                      <div className="w-full h-0.5 bg-primary/70 shadow-[0_0_12px_rgba(0,97,148,0.8)] animate-pulse"></div>
                    )}
                    <div className={`w-8 h-1 rounded-full ${isIdentified ? 'bg-secondary' : 'bg-primary'}`}></div>
                  </div>

                  {/* Match Overlay Badge */}
                  <div className="absolute bottom-4 left-4 right-4 bg-surface-container-lowest/95 backdrop-blur-md p-3 rounded-xl shadow-md flex items-center justify-between transition-all">
                    {isIdentified && passenger ? (
                      <>
                        <div className="flex items-center gap-2.5 text-left">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-on-secondary shrink-0">
                            <span className="material-symbols-outlined text-[20px]">verified</span>
                          </div>
                          <div>
                            <span className="font-label-sm text-label-sm text-secondary font-bold uppercase tracking-wider block">
                              Biometric Confirmed
                            </span>
                            <span className="font-label-md text-label-md text-on-surface font-bold">
                              {passenger.fullName} • {passenger.matchConfidence}%
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm font-bold shrink-0">
                          Match OK
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2.5 text-left">
                          <div className="w-8 h-8 rounded-full bg-surface-container text-primary flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[20px] animate-pulse">face</span>
                          </div>
                          <div>
                            <span className="font-label-sm text-label-sm text-on-surface-variant font-semibold uppercase tracking-wider block">
                              Awaiting Traveler Biometrics
                            </span>
                            <span className="font-label-sm text-label-sm text-on-surface">
                              Position face in oval or scan pass below
                            </span>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm font-semibold shrink-0">
                          {loading ? 'Analyzing...' : 'Ready'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Hidden File Input for photo fallback */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                <div className="mt-6 w-full flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleFaceScan}
                    disabled={loading}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-primary text-on-primary font-label-md text-label-md font-bold shadow-sm hover:bg-primary-container active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[20px]">face</span>
                    <span>{loading ? 'Verifying AI Biometrics...' : isIdentified ? 'Re-Scan Face' : 'Scan Face (AI Match)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="w-full sm:w-auto px-4 py-3.5 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[20px]">upload</span>
                    <span>Upload Test Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsManualModalOpen(true)}
                    className="w-full sm:w-auto px-5 py-3.5 rounded-xl bg-surface-container-low text-on-surface font-label-md text-label-md hover:bg-surface-container-high transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                    <span>Scan Boarding Pass Manually</span>
                  </button>
                </div>
              </div>

              {/* Right: Flight & Passenger Manifest Card */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 bg-surface-container-low -mx-6 -mt-6 px-6 pt-6 rounded-t-xl">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-primary text-on-primary font-bold text-center flex items-center justify-center font-label-sm text-label-sm">
                        QR
                      </span>
                      <div>
                        <span className="font-headline-sm text-headline-sm text-on-surface font-bold">
                          Flight {passenger?.flightNumber || defaultFlight.flightNumber}
                        </span>
                        <span className="block font-label-sm text-label-sm text-on-surface-variant">
                          {defaultFlight.airline}
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-label-sm uppercase font-bold">
                      On Time
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="font-label-sm text-label-sm text-on-surface-variant block">Departing</span>
                      <span className="font-headline-md text-2xl font-black text-primary">
                        {passenger?.destinationIata || defaultFlight.destinationIata}
                      </span>
                      <span className="font-body-md text-on-surface block text-sm">
                        {passenger?.destinationName || defaultFlight.destinationName}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-label-sm text-label-sm text-on-surface-variant block">Boarding</span>
                      <span className="font-headline-md text-2xl font-black text-on-surface">
                        {passenger?.boardingTime || defaultFlight.boardingTime}
                      </span>
                      <span className="font-body-md text-on-surface block text-sm">
                        {passenger?.gate || defaultFlight.gate}
                      </span>
                    </div>
                  </div>

                  {/* Passenger Manifest Details */}
                  <div className="p-3.5 rounded-lg bg-surface-container-low space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant font-label-sm">Passenger Name:</span>
                      <span className={`font-label-md font-bold ${isIdentified ? 'text-on-surface' : 'text-on-surface-variant/60 italic'}`}>
                        {isIdentified && passenger ? passenger.fullName : '[Waiting for Biometric Scan]'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant font-label-sm">Booking Ref / PNR:</span>
                      <span className={`font-label-md font-mono ${isIdentified ? 'text-primary font-bold' : 'text-on-surface-variant/60'}`}>
                        {isIdentified && passenger ? passenger.bookingReference : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant font-label-sm">Cabin & Seat:</span>
                      <span className="font-label-md text-on-surface">
                        {isIdentified && passenger ? `${passenger.cabinClass} • ${passenger.seatNumber}` : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant font-label-sm">Baggage Entitlement:</span>
                      {isIdentified && passenger ? (
                        <span className="px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-sm font-bold">
                          {passenger.baggageEntitlement}
                        </span>
                      ) : (
                        <span className="text-on-surface-variant/60 text-sm">—</span>
                      )}
                    </div>
                  </div>

                  {/* Dangerous Goods Notice */}
                  <div className="p-3.5 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[20px] text-tertiary mt-0.5">battery_alert</span>
                    <div className="text-xs space-y-0.5">
                      <span className="font-bold block">Cabin Only Baggage Rules</span>
                      <p className="text-on-tertiary-fixed">
                        Spare lithium batteries, power banks, and electronic vapes MUST remain in carry-on luggage. Do not place in checked drop.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Big Proceed Button — Disabled until verified! */}
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    disabled={!isIdentified || loading}
                    className={`w-full h-16 rounded-xl font-label-lg font-bold shadow-md transition-all flex items-center justify-center gap-3 text-lg ${
                      isIdentified
                        ? 'bg-primary text-on-primary hover:bg-primary-container active:scale-[0.99] cursor-pointer'
                        : 'bg-surface-container-high text-on-surface-variant/50 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <span>Confirm Identity & Proceed to Baggage Drop</span>
                    <span className="material-symbols-outlined text-[24px]">arrow_forward</span>
                  </button>
                  {!isIdentified && (
                    <p className="text-center text-xs text-on-surface-variant">
                      * Look into camera or scan boarding pass to unlock drop belt
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: Baggage Count & Conveyor Placement Guide                          */}
        {/* ========================================================================= */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm font-semibold">
                  <span className="material-symbols-outlined text-[16px]">luggage</span>
                  <span>Step 2 of 6 • Baggage Count & Alignment</span>
                </div>
                <h1 className="font-headline-lg text-2xl md:text-3xl font-bold text-on-surface">Select Total Bags to Check-In Today</h1>
                <p className="font-body-md text-on-surface-variant">Your reservation includes 2 complimentary standard checked items up to 23 kg each.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-label-md font-mono font-bold">
                  Belt Scale: Zeroed (0.00 kg)
                </span>
              </div>
            </div>

            {/* Bag Count Selector */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { count: 1, title: '1 Bag', desc: 'Single piece check-in. Standard allowance.', tag: 'Included', note: 'Up to 23.0 kg', extra: null },
                { count: 2, title: '2 Bags', desc: 'Both pieces covered under your ticket entitlement.', tag: 'Complimentary', note: '2 x 23.0 kg max', extra: 'Full Quota' },
                { count: 3, title: '3+ Bags', desc: 'Additional baggage piece with airline excess charge.', tag: '+$75 Extra Bag', note: 'Payment at Kiosk', extra: null }
              ].map(opt => {
                const isSelected = bagCount === opt.count
                return (
                  <div
                    key={opt.count}
                    onClick={() => {
                      setBagCount(opt.count)
                      showToast(`Checked bag count set to: ${opt.count} bag${opt.count > 1 ? 's' : ''}`)
                    }}
                    className={`cursor-pointer p-6 rounded-xl bg-surface-container-lowest hover:bg-surface-container-low transition-all space-y-4 ${
                      isSelected ? 'ring-2 ring-primary shadow-md' : 'shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-1 text-primary">
                        <span className="material-symbols-outlined text-[36px]">luggage</span>
                        {opt.count > 1 && <span className="material-symbols-outlined text-[32px] -ml-3">luggage</span>}
                        {opt.count > 2 && <span className="material-symbols-outlined text-[20px]">+</span>}
                      </div>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center ${isSelected ? 'bg-primary text-on-primary' : 'bg-surface-variant'}`}>
                        {isSelected && <span className="material-symbols-outlined text-[16px]">check</span>}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-headline-sm text-xl font-bold text-on-surface">{opt.title}</h2>
                        {opt.extra && (
                          <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm font-bold">
                            {opt.extra}
                          </span>
                        )}
                      </div>
                      <p className="font-body-md text-sm text-on-surface-variant mt-1">{opt.desc}</p>
                    </div>

                    <div className="pt-2 flex justify-between items-center text-sm font-label-sm">
                      <span className={opt.count === 3 ? 'text-tertiary font-bold' : 'text-secondary font-bold'}>{opt.tag}</span>
                      <span className="text-on-surface-variant">{opt.note}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Conveyor Placement Guidelines */}
            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-primary text-[28px]">conveyor_belt</span>
                <h2 className="font-headline-md text-xl font-bold text-on-surface">Physical Belt Placement Instructions</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-xl bg-surface-container-low flex flex-col items-center text-center space-y-3">
                  <div className="w-20 h-20 rounded-2xl bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                    <span className="material-symbols-outlined text-[48px]">vertical_align_bottom</span>
                  </div>
                  <span className="font-label-md text-on-surface font-bold">1. Upright Placement</span>
                  <p className="text-sm text-on-surface-variant">Place suitcase resting flat on its bottom wheels or base to ensure steady rolling.</p>
                </div>

                <div className="p-6 rounded-xl bg-surface-container-low flex flex-col items-center text-center space-y-3">
                  <div className="w-20 h-20 rounded-2xl bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                    <span className="material-symbols-outlined text-[48px]">swap_horiz</span>
                  </div>
                  <span className="font-label-md text-on-surface font-bold">2. Wheels Facing Rear</span>
                  <p className="text-sm text-on-surface-variant">Point main handle facing outward toward you, wheels facing backwards onto belt.</p>
                </div>

                <div className="p-6 rounded-xl bg-surface-container-low flex flex-col items-center text-center space-y-3">
                  <div className="w-20 h-20 rounded-2xl bg-surface-container-lowest flex items-center justify-center text-tertiary shadow-sm">
                    <span className="material-symbols-outlined text-[48px]">warning</span>
                  </div>
                  <span className="font-label-md text-on-surface font-bold">3. Tuck Loose Straps</span>
                  <p className="text-sm text-on-surface-variant">Loose backpack strings and duffle handles must be secured to avoid conveyor jam.</p>
                </div>
              </div>

              <div className="mt-8 p-4 rounded-xl bg-surface-container flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px]">scale</span>
                  </div>
                  <div>
                    <span className="font-label-md text-on-surface font-bold">Optical Belt Ready: Gate 04 Scale Cleared</span>
                    <p className="text-sm text-on-surface-variant">Please place your first luggage item onto the rubber track now.</p>
                  </div>
                </div>
                <div className="font-mono text-2xl text-primary font-bold">0.00 kg</div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="h-14 px-6 rounded-xl bg-surface-container-low text-on-surface font-label-md hover:bg-surface-container-high transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                <span>Back to Passenger ID</span>
              </button>
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="h-16 px-8 rounded-xl bg-primary text-on-primary font-label-lg font-bold shadow-md hover:bg-primary-container active:scale-95 transition-all flex items-center gap-2 text-lg"
              >
                <span>Bag Placed on Belt — Start Weighing</span>
                <span className="material-symbols-outlined text-[24px]">scale</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: Weigh & Measure + Overweight Fee Settlement                       */}
        {/* ========================================================================= */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm font-semibold">
                  <span className="material-symbols-outlined text-[16px]">monitor_weight</span>
                  <span>Step 3 of 6 • Dynamic Weighing & Volumetric Scan</span>
                </div>
                <h1 className="font-headline-lg text-2xl md:text-3xl font-bold text-on-surface">3D Dimension & Scale Analysis</h1>
                <p className="font-body-md text-on-surface-variant">Laser rangefinders and integrated piezoelectric floor sensors analyze load integrity.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleWeightSim}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface font-label-sm text-label-sm hover:bg-surface-container-highest transition-all flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                  <span>Toggle Standard / Overweight</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: 3D Wireframe Suitcase Visualizer */}
              <div className="lg:col-span-7 bg-surface-container-lowest p-8 rounded-xl shadow-sm flex flex-col items-center justify-between relative min-h-[420px]">
                <div className="w-full flex justify-between items-center text-xs font-mono text-on-surface-variant">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-secondary"></span> 3D LIDAR: ACTIVE
                  </span>
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

                    <div className="absolute -top-3 left-4 px-2 py-0.5 rounded bg-surface-container-lowest shadow text-[11px] font-mono font-bold text-primary">
                      Length: 72 cm
                    </div>
                    <div className="absolute top-1/2 -right-8 -translate-y-1/2 px-2 py-0.5 rounded bg-surface-container-lowest shadow text-[11px] font-mono font-bold text-primary [writing-mode:vertical-rl]">
                      Height: 48 cm
                    </div>
                    <div className="absolute -bottom-3 right-4 px-2 py-0.5 rounded bg-surface-container-lowest shadow text-[11px] font-mono font-bold text-primary">
                      Width: 28 cm
                    </div>
                  </div>
                </div>

                <div className="w-full p-3.5 rounded-lg bg-surface-container-low flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[20px]">check_circle</span>
                    <span className="text-sm text-on-surface">
                      Dimensions: <strong className="font-bold">72 × 48 × 28 cm</strong> (Linear Total: 148 cm ≤ 158 cm Max)
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-sm font-bold text-xs">
                    Standard Size Compliant
                  </span>
                </div>
              </div>

              {/* Right: Scale Readout & Surcharge Options */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm space-y-4">
                  <span className="font-label-sm text-on-surface-variant block uppercase tracking-wider font-semibold">
                    Belt Scale Gross Weight
                  </span>
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-extrabold tracking-tight text-on-surface">
                        {currentWeightVal}
                      </span>
                      <span className="text-2xl text-on-surface-variant">kg</span>
                    </div>
                    <div className="text-right">
                      <span className="font-label-sm text-on-surface-variant block">Allowance</span>
                      <span className="text-xl font-bold text-primary">23.0 kg</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="w-full h-3 rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCurrentlyOverweight ? 'bg-tertiary' : 'bg-secondary'
                        }`}
                        style={{ width: isCurrentlyOverweight ? '96%' : '79%' }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-on-surface-variant font-mono">
                      <span>0 kg</span>
                      <span>23 kg (Max Free)</span>
                      <span>32 kg (Heavy Max)</span>
                    </div>
                  </div>

                  {/* Overweight Alert */}
                  {isCurrentlyOverweight && (
                    <div className="p-4 rounded-xl bg-tertiary-fixed text-on-tertiary-fixed space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[24px] text-tertiary">warning</span>
                        <span className="font-headline-sm font-bold text-tertiary text-lg">Luggage Exceeds Allowance (+3.8 kg)</span>
                      </div>
                      <p className="text-sm text-on-tertiary-fixed">
                        Current weight is 26.8 kg. Your complimentary limit is 23.0 kg. To clear this bag onto the flight, settle the airline excess weight fee.
                      </p>
                      <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={payFeeBtn => payExcessFee()}
                          className="px-3 py-3 rounded-lg bg-tertiary text-on-tertiary font-label-md font-bold flex items-center justify-center gap-2 hover:bg-tertiary-container shadow-sm active:scale-95 transition-all text-sm"
                        >
                          <span className="material-symbols-outlined text-[18px]">contactless</span>
                          <span>Pay Surcharge $45.00</span>
                        </button>
                        <button
                          type="button"
                          onClick={repackLuggage}
                          className="px-3 py-3 rounded-lg bg-surface-container-lowest text-on-surface font-label-md text-sm hover:bg-surface-container-low transition-all font-semibold"
                        >
                          <span>Repack / Remove</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Approved State Banner */}
                  {!isCurrentlyOverweight && (
                    <div className="p-3.5 rounded-lg bg-secondary-container text-on-secondary-container flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-[22px] text-secondary">check_circle</span>
                      <div>
                        <span className="font-label-md font-bold block">
                          {hasPaidExcessFee ? 'Weight Approved • Surcharge Paid ($45.00)' : 'Weight Approved for Dispatch'}
                        </span>
                        <span className="text-sm">
                          {hasPaidExcessFee ? 'Excess payment cleared. RFID tag ready.' : 'Item #1 is within your 23.0 kg allowance. RFID tag ready.'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="h-14 px-6 rounded-xl bg-surface-container-low text-on-surface font-label-md hover:bg-surface-container-high transition-all"
                  >
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToTag}
                    disabled={isCurrentlyOverweight || loading}
                    className={`flex-1 h-16 rounded-xl bg-primary text-on-primary font-label-lg font-bold shadow-md hover:bg-primary-container active:scale-95 transition-all flex items-center justify-center gap-2 text-lg ${
                      isCurrentlyOverweight ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <span>{loading ? 'Printing Tag...' : 'Accept & Proceed to Tag Printing'}</span>
                    <span className="material-symbols-outlined text-[24px]">print</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: Automated Bag Tag Printing & Attachment Guide                     */}
        {/* ========================================================================= */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm font-semibold">
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  <span>Step 4 of 6 • Tag Generation & Physical Attachment</span>
                </div>
                <h1 className="font-headline-lg text-2xl md:text-3xl font-bold text-on-surface">Collect and Attach Your Luggage Tag</h1>
                <p className="font-body-md text-on-surface-variant">The thermal dispenser has produced your airline RFID tracking loop below.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded bg-secondary-container text-on-secondary-container font-label-sm font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">sensors</span>
                  <span>RFID Inlay Encoded (EPC Gen2)</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Printed Bag Tag */}
              <div className="lg:col-span-6 bg-surface-container-lowest p-8 rounded-xl shadow-sm flex flex-col items-center space-y-6">
                <span className="font-label-md text-on-surface font-bold uppercase tracking-wider">Printed Bag Tag Representation</span>

                <div className="w-full max-w-sm rounded-2xl bg-surface-container-lowest p-5 shadow-xl border-2 border-dashed border-outline-variant space-y-3 font-mono">
                  <div className="flex justify-between items-center pb-2 border-b border-outline-variant">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-lg text-primary">QATAR</span>
                      <span className="text-xs bg-surface-container-high px-1.5 py-0.5 rounded font-bold">{passenger?.flightNumber || defaultFlight.flightNumber}</span>
                    </div>
                    <span className="text-xs font-bold text-secondary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">nfc</span> RFID ACTIVE
                    </span>
                  </div>

                  <div className="text-center py-2">
                    <span className="text-xs uppercase text-on-surface-variant block tracking-widest">Final Destination</span>
                    <span className="text-5xl font-black text-on-surface tracking-tighter">{passenger?.destinationIata || defaultFlight.destinationIata}</span>
                    <span className="text-xs text-on-surface-variant block mt-0.5">{passenger?.destinationName || defaultFlight.destinationName}</span>
                  </div>

                  <div className="text-xs space-y-1 pt-1 border-t border-outline-variant">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">PASSENGER:</span>
                      <span className="font-bold text-on-surface">{passenger?.fullName || 'PASSENGER'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">FLIGHT / DATE:</span>
                      <span className="font-bold text-on-surface">{passenger?.flightNumber || defaultFlight.flightNumber} / TODAY</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">WEIGHT / PIECE:</span>
                      <span className="font-bold text-primary">{currentWeightVal} KG / BAG 1 OF {bagCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">TAG NUMBER:</span>
                      <span className="font-bold text-on-surface">{tagData.tagNumber}</span>
                    </div>
                  </div>

                  <div className="pt-3 flex flex-col items-center">
                    <div className="w-full h-12 bg-on-surface flex items-center justify-between px-2 text-[9px] text-surface font-mono tracking-widest overflow-hidden text-white font-bold">
                      || | |||| | ||| |||| | | |||| | || |||| | | |||| || | |||| | ||
                    </div>
                    <span className="text-[10px] text-on-surface-variant mt-1 tracking-widest font-mono font-semibold">
                      0 157 {tagData.tagNumber.replace(/\D/g, '').slice(0, 8)} 9
                    </span>
                  </div>
                </div>

                <div className="w-full p-4 rounded-xl bg-surface-container flex items-center justify-between gap-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-[28px]">arrow_downward</span>
                    <span className="font-label-md text-on-surface font-bold">Collect Tag from Dispenser Below</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast('Dispenser re-issuing thermal RFID tag...')}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface font-label-sm text-label-sm hover:bg-surface-container-high transition-all flex items-center gap-1 shadow-sm font-semibold"
                  >
                    <span className="material-symbols-outlined text-[16px]">replay</span>
                    <span>Reprint Tag</span>
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="lg:col-span-6 space-y-6">
                <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm space-y-4">
                  <h2 className="font-headline-md text-xl font-bold text-on-surface">How to Fasten the Tag to Your Luggage</h2>
                  <div className="space-y-4">
                    <div className="flex items-start gap-4 p-3 rounded-lg bg-surface-container-low">
                      <div className="w-8 h-8 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center shrink-0">1</div>
                      <div className="space-y-1">
                        <span className="font-label-md text-on-surface font-bold">Peel Backing Paper</span>
                        <p className="text-sm text-on-surface-variant">Peel the adhesive backing film from the ends. Keep the passenger claim receipt tab intact.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-3 rounded-lg bg-surface-container-low">
                      <div className="w-8 h-8 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center shrink-0">2</div>
                      <div className="space-y-1">
                        <span className="font-label-md text-on-surface font-bold">Loop Through Top Handle</span>
                        <p className="text-sm text-on-surface-variant">Thread the strap around the rigid top carry handle. Avoid attaching to wheels or extending poles.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4 p-3 rounded-lg bg-surface-container-low">
                      <div className="w-8 h-8 rounded-full bg-primary text-on-primary font-bold flex items-center justify-center shrink-0">3</div>
                      <div className="space-y-1">
                        <span className="font-label-md text-on-surface font-bold">Press Ends Firmly Together</span>
                        <p className="text-sm text-on-surface-variant">Join both adhesive tabs end-to-end. Press firmly for 2 seconds to form a tamper-evident seal.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => goToStep(3)}
                    className="h-14 px-6 rounded-xl bg-surface-container-low text-on-surface font-label-md hover:bg-surface-container-high transition-all"
                  >
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => goToStep(5)}
                    className="flex-1 h-16 rounded-xl bg-primary text-on-primary font-label-lg font-bold shadow-md hover:bg-primary-container active:scale-95 transition-all flex items-center justify-center gap-2 text-lg"
                  >
                    <span>I Have Attached the Tag — Scan & Verify</span>
                    <span className="material-symbols-outlined text-[24px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 5: Optical Verification & Conveyor Dispatch                          */}
        {/* ========================================================================= */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm font-semibold">
                  <span className="material-symbols-outlined text-[16px]">qr_code_scanner</span>
                  <span>Step 5 of 6 • Automated Verification & Sorter Dispatch</span>
                </div>
                <h1 className="font-headline-lg text-2xl md:text-3xl font-bold text-on-surface">Optical Tunnel Verification</h1>
                <p className="font-body-md text-on-surface-variant">Multi-angle laser scanners and RFID tunnel antennas are reading your attached bag tag.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setScanStatus('error')
                    showToast('Optical warning: Tag obscured or upside down.')
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-container-high text-tertiary font-label-sm text-label-sm hover:bg-surface-container-highest transition-all flex items-center gap-1 font-semibold"
                >
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>Simulate Error</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScanStatus('success')
                    showToast('Optical Tunnel: Tag barcode and RFID match 100%.')
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-container-high text-secondary font-label-sm text-label-sm hover:bg-surface-container-highest transition-all flex items-center gap-1 font-semibold"
                >
                  <span className="material-symbols-outlined text-[16px]">check</span>
                  <span>Simulate Clear</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Laser Tunnel Viewfinder */}
              <div className="lg:col-span-7 bg-surface-container-lowest p-8 rounded-xl shadow-sm flex flex-col items-center justify-between relative min-h-[420px] overflow-hidden">
                <div className="w-full flex justify-between items-center text-xs font-mono text-on-surface-variant">
                  <span>OPTICAL TUNNEL CAM #04</span>
                  <span className="text-secondary font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-secondary"></span> 360 SCAN READY
                  </span>
                </div>

                <div className="relative w-full max-w-lg aspect-video rounded-2xl bg-inverse-surface/90 flex items-center justify-center overflow-hidden my-4">
                  <div className="absolute inset-0 flex flex-col justify-around pointer-events-none opacity-70">
                    <div className="w-full h-0.5 bg-secondary shadow-[0_0_8px_currentColor] animate-pulse"></div>
                    <div className="w-full h-0.5 bg-primary shadow-[0_0_8px_currentColor]"></div>
                    <div className="w-full h-0.5 bg-secondary shadow-[0_0_8px_currentColor] animate-pulse"></div>
                  </div>

                  <div className="relative z-10 flex flex-col items-center text-surface-container-lowest">
                    <span className="material-symbols-outlined text-[120px] text-surface-variant/40">luggage</span>
                    <div
                      className={`absolute top-10 right-16 w-16 h-12 rounded border-2 flex items-center justify-center ${
                        scanStatus === 'success'
                          ? 'border-secondary bg-secondary/10'
                          : 'border-tertiary bg-tertiary/20 animate-bounce'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[18px] ${scanStatus === 'success' ? 'text-secondary' : 'text-tertiary'}`}>
                        qr_code
                      </span>
                    </div>
                  </div>

                  <div className="absolute bottom-3 left-4 right-4 flex justify-between items-center text-[11px] font-mono text-surface-container-lowest">
                    <span>RFID SIGNAL: -48 dBm (EXCELLENT)</span>
                    <span>BARCODE DECODE: {scanStatus === 'success' ? '100%' : 'FAILED'}</span>
                  </div>
                </div>

                {scanStatus === 'success' ? (
                  <div className="w-full p-3.5 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-[22px]">verified</span>
                      <span className="font-label-md font-bold">Tag Successfully Read and Verified</span>
                    </div>
                    <span className="font-mono font-bold text-sm">{tagData.tagNumber}</span>
                  </div>
                ) : (
                  <div className="w-full p-3.5 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-tertiary text-[22px]">error</span>
                      <span className="font-label-md font-bold">Tag Not Detected — Please Turn Tag Face Up</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setScanStatus('success')}
                      className="px-3 py-1 rounded bg-tertiary text-on-tertiary font-label-sm font-bold"
                    >
                      Retry Scan
                    </button>
                  </div>
                )}
              </div>

              {/* Conveyor Motor Telemetry & Dispatch CTA */}
              <div className="lg:col-span-5 space-y-6 flex flex-col justify-between">
                <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm space-y-4">
                  <h2 className="font-headline-sm text-lg font-bold text-on-surface">Conveyor Subsystem Telemetry</h2>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-lg bg-surface-container-low">
                      <span className="text-xs text-on-surface-variant font-label-sm block">Conveyor Motor Target</span>
                      <span className="font-headline-sm text-xl text-on-surface font-mono font-bold">1.20 m/s</span>
                      <span className="text-[11px] text-secondary font-bold block mt-0.5">• Synchronized</span>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-container-low">
                      <span className="text-xs text-on-surface-variant font-label-sm block">Airlock Door</span>
                      <span className="font-headline-sm text-xl text-on-surface font-mono font-bold">ARMED</span>
                      <span className="text-[11px] text-secondary font-bold block mt-0.5">• Clear to Inject</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-surface-container-low space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">SORTER ALLOCATION:</span>
                      <span className="font-bold text-on-surface">{tagData.sorterAllocation}</span>
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
                    type="button"
                    onClick={dispatchLuggageToFlight}
                    disabled={scanStatus !== 'success' || loading}
                    className={`w-full h-20 rounded-2xl bg-secondary text-on-secondary font-headline-md text-2xl font-bold shadow-xl hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 ${
                      scanStatus !== 'success' ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <span className="material-symbols-outlined text-[32px]">send</span>
                    <span>{loading ? 'CONVEYOR ADVANCING...' : 'DISPATCH BAG TO FLIGHT'}</span>
                  </button>
                  <p className="text-center font-body-md text-sm text-on-surface-variant">
                    Conveyor safety door will close once belt starts moving.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 6: Clearance Complete & Digital Claim Pass Receipt                   */}
        {/* ========================================================================= */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div className="bg-secondary-container text-on-secondary-container p-8 rounded-2xl shadow-sm text-center space-y-2">
              <div className="w-16 h-16 rounded-full bg-secondary text-on-secondary mx-auto flex items-center justify-center shadow-md">
                <span className="material-symbols-outlined text-[36px]">task_alt</span>
              </div>
              <h1 className="font-display-md text-3xl md:text-4xl font-bold tracking-tight">All Set! Baggage Checked In</h1>
              <p className="font-body-xl text-lg max-w-2xl mx-auto">
                Your baggage is on its way through sorting to Flight {passenger?.flightNumber || defaultFlight.flightNumber}. You may proceed through passport control and security.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Claim Receipts */}
              <div className="lg:col-span-7 bg-surface-container-lowest p-8 rounded-xl shadow-sm space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
                  <div>
                    <span className="font-headline-sm text-xl font-bold text-on-surface">Luggage Claim Receipts</span>
                    <span className="font-body-md text-sm text-on-surface-variant block">
                      Booking Reference: <strong className="text-primary font-mono">{passenger?.bookingReference || 'QR-082'}</strong>
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded bg-surface-container text-primary font-label-md font-mono font-bold">
                    {bagCount} Bags Handled
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                      <span className="material-symbols-outlined text-[28px]">luggage</span>
                    </div>
                    <div>
                      <span className="font-label-md text-on-surface font-bold">Bag 1 • {tagData.tagNumber}</span>
                      <span className="text-xs text-on-surface-variant block">
                        Gross Weight: {currentWeightVal} kg • {isOverweightSim ? 'Surcharge Paid ($45.00)' : 'Standard Compliant'}
                      </span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm font-bold">
                    Accepted
                  </span>
                </div>

                {bagCount > 1 && (
                  <div className="p-4 rounded-xl bg-surface-container-low flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-surface-container-lowest flex items-center justify-center text-primary shadow-sm">
                        <span className="material-symbols-outlined text-[28px]">luggage</span>
                      </div>
                      <div>
                        <span className="font-label-md text-on-surface font-bold">Bag 2 • QR-082-992145</span>
                        <span className="text-xs text-on-surface-variant block">
                          Gross Weight: 19.4 kg • Standard Compliant
                        </span>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm font-bold">
                      Accepted
                    </span>
                  </div>
                )}

                <div className="p-3.5 rounded-lg bg-surface-container text-xs text-on-surface space-y-1">
                  <span className="font-bold block text-sm">Arrival Carousel:</span>
                  <p className="text-on-surface-variant">
                    Collect your luggage at Doha Hamad International Airport (DOH) • Baggage Claim Hall Carousel #08 upon landing.
                  </p>
                </div>
              </div>

              {/* Wayfinding & Claim Pass */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm space-y-3">
                  <span className="font-label-sm text-on-surface-variant uppercase tracking-wider block font-semibold">Your Next Step</span>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-3xl font-extrabold text-primary block">
                        {(passenger?.gate || defaultFlight.gate).split('•')[0]}
                      </span>
                      <span className="text-sm text-on-surface font-semibold">Concourse B • Level 2</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-secondary font-bold block">Security: Light</span>
                      <span className="text-sm text-on-surface font-semibold">~7-9 min walk</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-container-low flex items-center gap-2.5 text-xs text-on-surface">
                    <span className="material-symbols-outlined text-primary text-[20px]">schedule</span>
                    <span>
                      Gate opens at <strong>{passenger?.boardingTime || defaultFlight.boardingTime}</strong>. Boarding begins in 45 minutes.
                    </span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm space-y-3">
                  <span className="font-label-sm text-on-surface-variant block font-semibold">Save Your Baggage Claim Receipts</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => showToast('Claim receipt pass sent via SMS to passenger phone.')}
                      className="px-3 py-3 rounded-lg bg-surface-container-low text-on-surface font-label-sm hover:bg-surface-container-high transition-all flex items-center justify-center gap-2 shadow-sm font-semibold"
                    >
                      <span className="material-symbols-outlined text-[18px] text-primary">sms</span>
                      <span>Send to SMS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => showToast('Apple/Google Wallet Pass downloaded.')}
                      className="px-3 py-3 rounded-lg bg-surface-container-low text-on-surface font-label-sm hover:bg-surface-container-high transition-all flex items-center justify-center gap-2 shadow-sm font-semibold"
                    >
                      <span className="material-symbols-outlined text-[18px] text-primary">wallet</span>
                      <span>Apple/Google Pass</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast('Thermal printer dispensing paper luggage claim slip.')}
                    className="w-full py-3 rounded-lg bg-surface-container text-on-surface font-label-sm hover:bg-surface-container-high transition-all flex items-center justify-center gap-2 font-semibold"
                  >
                    <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                    <span>Print Physical Paper Receipt Slip</span>
                  </button>
                </div>

                {/* Auto-Reset Countdown */}
                <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between">
                  <div className="text-xs text-on-surface-variant">
                    <span>Station will reset in:</span>
                    <span className="font-bold text-on-surface block font-mono text-sm">{secondsRemaining} seconds</span>
                  </div>
                  <button
                    type="button"
                    onClick={resetFlow}
                    className="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-sm hover:bg-primary-container transition-all font-bold"
                  >
                    Start New Check-In
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Manual Boarding Pass Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-5 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-outline-variant/30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-lg font-bold text-on-surface">Scan Boarding Pass Manually</h3>
                  <span className="text-xs text-on-surface-variant">Optical 2D Barcode Scanner Reader</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="w-8 h-8 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Direct Barcode / PNR Input */}
            <div className="space-y-2">
              <label className="font-label-sm text-xs font-bold text-on-surface-variant block uppercase tracking-wider">
                Enter Booking Reference (PNR) or Barcode:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualBarcodeInput}
                  onChange={(e) => setManualBarcodeInput(e.target.value)}
                  placeholder="e.g. QR-9Y8K2X or PNR"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-outline-variant bg-surface-container-low text-on-surface font-mono text-sm uppercase focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleBoardingPassScan(manualBarcodeInput)}
                  disabled={loading || !manualBarcodeInput.trim()}
                  className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-label-md text-sm font-bold disabled:opacity-50 hover:bg-primary-container active:scale-95 transition-all"
                >
                  {loading ? 'Verifying...' : 'Validate'}
                </button>
              </div>
            </div>

            {/* Quick-Pick Registered Manifest Passengers */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-xs text-on-surface-variant">
                <span className="font-bold uppercase tracking-wider">Select Registered Passenger (Flight QR-082):</span>
                <span>From Database</span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {manifestList && manifestList.length > 0 ? (
                  manifestList.map((m) => (
                    <div
                      key={m.passengerId}
                      onClick={() => handleBoardingPassScan(m.bookingReference || m.barcode)}
                      className="cursor-pointer p-3 rounded-xl bg-surface-container-low hover:bg-surface-container hover:border-primary/50 border border-transparent transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface-container-lowest flex items-center justify-center font-bold text-primary text-xs shadow-sm group-hover:bg-primary group-hover:text-on-primary transition-all">
                          P{m.passengerId}
                        </div>
                        <div>
                          <span className="font-label-md text-sm font-bold text-on-surface block group-hover:text-primary transition-all">
                            {m.fullName}
                          </span>
                          <span className="text-xs font-mono text-on-surface-variant">
                            PNR: {m.bookingReference} • Seat {m.seatNumber}
                          </span>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-surface-container-lowest text-primary text-xs font-bold font-mono group-hover:bg-primary-fixed group-hover:text-on-primary-fixed transition-all">
                        Scan Pass
                      </span>
                    </div>
                  ))
                ) : (
                  <button
                    type="button"
                    onClick={() => handleBoardingPassScan('QR-9Y8K2X')}
                    className="w-full p-3 rounded-xl bg-surface-container-low hover:bg-surface-container text-left text-sm font-bold text-primary"
                  >
                    Load Default Manifest Passenger (Layla Hassan • QR-9Y8K2X)
                  </button>
                )}
              </div>
            </div>

            <div className="pt-2 text-center">
              <p className="text-xs text-on-surface-variant">
                Simulating 2D Honeywell barcode optical beam at AeroGate Self-Drop #04.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-inverse-surface text-inverse-on-surface font-label-md text-sm shadow-lg flex items-center gap-2 animate-fade-in">
          <span className="material-symbols-outlined text-[20px] text-secondary-fixed">info</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Station Status Footer */}
      <footer className="w-full bg-surface-container-lowest/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-30">
        <div className="w-full px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse"></span>
              <span className="font-label-sm text-sm text-on-surface">
                Scale & Optical Conveyor 04: <span className="font-bold text-secondary">ONLINE</span>
              </span>
            </div>
            <div className="h-4 w-px bg-outline-variant"></div>
            <div className="flex items-center gap-1.5 text-on-surface-variant text-sm">
              <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
              <span>Optical Belt • Ready</span>
            </div>
            <div className="h-4 w-px bg-outline-variant"></div>
            <div className="flex items-center gap-1.5 text-on-surface-variant text-sm">
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>RFID Tag Dispenser: 94%</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => showToast('Audio guide playing instructions in English.')}
              className="px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant font-label-sm text-xs flex items-center gap-1.5 hover:bg-surface-container-high hover:text-on-surface transition-all font-semibold"
            >
              <span className="material-symbols-outlined text-[16px]">volume_up</span>
              <span>Audio Guide</span>
            </button>
            <button
              type="button"
              onClick={() => showToast('High contrast display toggled.')}
              className="px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface-variant font-label-sm text-xs flex items-center gap-1.5 hover:bg-surface-container-high hover:text-on-surface transition-all font-semibold"
            >
              <span className="material-symbols-outlined text-[16px]">contrast</span>
              <span>High Contrast</span>
            </button>
            <span className="font-label-sm text-xs text-on-surface-variant pl-2">v4.18-KioskOS</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
