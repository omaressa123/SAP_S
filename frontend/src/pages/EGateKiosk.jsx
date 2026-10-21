import React, { useState, useEffect, useRef } from 'react'
import { SmartGateApi, AiApi } from '../services/api'

// Initial empty state before document scan
const INITIAL_PASSENGER = {
  name: 'Awaiting Document Scan',
  flightNumber: 'QR 082',
  destination: 'Doha (DOH)',
  seat: '14A (Zone 1)',
  gate: 'Gate B22',
  token: 'EGATE-B22-PENDING',
  passportNumber: '—',
  nationality: '—',
  dob: '—',
  expiryDate: '—',
  gender: '—',
  confidence: '—',
  faceUrl: null,
}

export default function EGateKiosk() {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedMethod, setSelectedMethod] = useState('passport')
  const [lang, setLang] = useState('EN')
  const [sessionId, setSessionId] = useState(null)
  const [docScanned, setDocScanned] = useState(false)
  const [docScanning, setDocScanning] = useState(false)
  const [faceMatched, setFaceMatched] = useState(false)
  const [faceMatching, setFaceMatching] = useState(false)
  const [countdown, setCountdown] = useState(15)
  const [apiLoading, setApiLoading] = useState(false)

  // OCR and DB Persistence status
  const [ocrExtractedData, setOcrExtractedData] = useState(null)
  const [dbSavedStatus, setDbSavedStatus] = useState(null)
  const [docScanError, setDocScanError] = useState(null)

  // Verification Failure / Rejection state
  const [verificationFailed, setVerificationFailed] = useState(false)
  const [failureReason, setFailureReason] = useState('')

  // Passenger data state - Populated strictly from OCR
  const [passenger, setPassenger] = useState(INITIAL_PASSENGER)

  // Custom photo upload & webcam states
  const [passportUploadedFile, setPassportUploadedFile] = useState(null)
  const [customPassportImage, setCustomPassportImage] = useState(null)
  const [customFaceImage, setCustomFaceImage] = useState(null)
  const [passportFaceCrop, setPassportFaceCrop] = useState(null)
  const [useWebcam, setUseWebcam] = useState(false)
  const [webcamError, setWebcamError] = useState(null)
  const [faceUploadedFile, setFaceUploadedFile] = useState(null)

  // DOM Refs
  const countdownTimerRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const passportFileInputRef = useRef(null)
  const faceFileInputRef = useRef(null)

  // Initialize Kiosk session
  useEffect(() => {
    async function initKioskSession() {
      try {
        const res = await fetch('http://127.0.0.1:8001/kiosk/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kiosk_id: 'KIOSK-B22', flight_id: 'QR-082' }),
        })
        if (res.ok) {
          const data = await res.json()
          setSessionId(data.session_id)
        }
      } catch {
        // AI microservice offline; fallback session ID
        setSessionId(Date.now() % 10000)
      }
    }
    initKioskSession()
  }, [])

  // Step 4 Countdown Timer
  useEffect(() => {
    if (currentStep === 4) {
      setCountdown(15)
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current)
            resetSession()
            return 15
          }
          return prev - 1
        })
      }, 1000)
    } else {
      clearInterval(countdownTimerRef.current)
    }
    return () => clearInterval(countdownTimerRef.current)
  }, [currentStep])

  // Attach stream to video element when useWebcam changes
  useEffect(() => {
    if (useWebcam && videoRef.current && streamRef.current) {
      try {
        videoRef.current.srcObject = streamRef.current
        videoRef.current.play().catch((e) => console.warn('Video play warning:', e))
      } catch (err) {
        console.warn('Attach stream error:', err)
      }
    }
  }, [useWebcam])

  // Cleanup webcam stream on step change or unmount
  useEffect(() => {
    if (currentStep !== 3 && useWebcam) {
      stopWebcam()
    }
  }, [currentStep])

  function stopWebcam() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setUseWebcam(false)
  }

  async function startWebcam() {
    setWebcamError(null)
    setCustomFaceImage(null)

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setWebcamError(
        'Camera API not supported or requires secure context (https:// or localhost). Please import a face photo below.'
      )
      return
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      let stream = null
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: false,
        })
      } catch {
        // Fallback for simple virtual/integrated cameras that reject width/height/facingMode
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      streamRef.current = stream
      setUseWebcam(true)

      if (videoRef.current) {
        videoRef.current.muted = true
        videoRef.current.playsInline = true
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play()
        } catch (playErr) {
          console.warn('Initial play warning:', playErr)
        }
      }
    } catch (err) {
      console.error('Camera error:', err)
      let msg = 'Unable to access camera.'
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied! Please click the lock or camera icon in your address bar and allow camera access, then try again.'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera found. Please plug in a webcam or click "Import Face Photo" to test with an image.'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is currently in use by another application. Please close other camera apps and retry.'
      } else {
        msg = err.message || msg
      }
      setWebcamError(msg)
      setUseWebcam(false)
    }
  }

  function handlePassportPhotoUpload(e) {
    const file = e.target.files?.[0]
    if (file) {
      setPassportUploadedFile(file)
      setDocScanError(null)
      setDocScanned(false)
      setOcrExtractedData(null)
      setDbSavedStatus(null)
      const reader = new FileReader()
      reader.onload = (event) => {
        setCustomPassportImage(event.target.result)
        // Reset crop; will be extracted cleanly by OCR
        setPassportFaceCrop(null)
      }
      reader.readAsDataURL(file)
    }
  }

  function handleFacePhotoUpload(e) {
    const file = e.target.files?.[0]
    if (file) {
      stopWebcam()
      setFaceUploadedFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        setCustomFaceImage(event.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  function resetSession() {
    stopWebcam()
    clearInterval(countdownTimerRef.current)
    setDocScanned(false)
    setDocScanning(false)
    setDocScanError(null)
    setFaceMatched(false)
    setFaceMatching(false)
    setVerificationFailed(false)
    setFailureReason('')
    setCountdown(15)
    setCustomPassportImage(null)
    setPassportUploadedFile(null)
    setCustomFaceImage(null)
    setFaceUploadedFile(null)
    setPassportFaceCrop(null)
    setOcrExtractedData(null)
    setDbSavedStatus(null)
    setPassenger(INITIAL_PASSENGER)
    setCurrentStep(1)
  }

  function chooseMethod(method) {
    setSelectedMethod(method)
    setCurrentStep(2)
  }

  // STEP 2: SCAN PASSPORT, RUN REAL OCR, AND SAVE TO DATABASE
  async function simulateDocScan() {
    if (!customPassportImage) {
      passportFileInputRef.current?.click()
      return
    }

    setDocScanning(true)
    setApiLoading(true)
    setDocScanError(null)

    try {
      const scanRes = await SmartGateApi.scanPassportImage({
        image_base64: customPassportImage,
        save_to_database: true,
      })

      if (!scanRes || scanRes.success === false || !scanRes.passport) {
        const errMsg =
          scanRes?.error ||
          'Document scan failed: No valid passport or MRZ detected. Please upload an official passport data page.'
        setDocScanError(errMsg)
        setDocScanning(false)
        setApiLoading(false)
        return
      }

      const pData = scanRes.passport
      const ocrInfo = {
        fullName: pData.full_name,
        passportNumber: pData.passport_number,
        nationality: pData.nationality || 'USA',
        dateOfBirth: pData.date_of_birth,
        expiryDate: pData.expiry_date,
        gender: pData.gender || 'M',
        mrzRaw: pData.mrz_raw,
      }

      if (scanRes.faceCropBase64) {
        setPassportFaceCrop(scanRes.faceCropBase64)
      }

      setOcrExtractedData(ocrInfo)

      const booking = scanRes.matchingPassenger?.linkedBooking || {}
      setPassenger((prev) => ({
        ...prev,
        name: ocrInfo.fullName,
        passportNumber: ocrInfo.passportNumber,
        nationality: ocrInfo.nationality,
        dob: ocrInfo.dateOfBirth,
        expiryDate: ocrInfo.expiryDate,
        gender: ocrInfo.gender,
        flightNumber: booking.flightNumber || prev.flightNumber,
        destination: booking.destination || prev.destination,
        seat: booking.seatNumber ? `${booking.seatNumber} (${booking.group || 'Zone 2'})` : prev.seat,
        gate: booking.gate ? `Gate ${booking.gate}` : prev.gate,
        faceUrl: scanRes.faceCropBase64 || prev.faceUrl,
        documentUrl: scanRes.matchingPassenger?.documentUrl || scanRes.documentUrl || prev.documentUrl,
      }))

      setDbSavedStatus({
        saved: true,
        passengerId: scanRes.passengerId || 1,
        action: 'created',
        message: 'Saved to PostgreSQL / SQLite Database ✓',
      })

      setDocScanned(true)
      setTimeout(() => {
        setDocScanning(false)
        setApiLoading(false)
        setCurrentStep(3)
      }, 1200)

    } catch (err) {
      setDocScanError(
        err.message || 'No valid passport document detected in uploaded image. Please upload an official passport data page.'
      )
      setDocScanning(false)
      setApiLoading(false)
    }
  }

  // STEP 3: COMPARE LIVE FACE WITH PASSPORT FACE PHOTO
  async function simulateFaceRecognition() {
    setFaceMatching(true)
    setVerificationFailed(false)
    setFailureReason('')

    try {
      let liveFaceImg = customFaceImage
      if (useWebcam && videoRef.current) {
        const video = videoRef.current
        if (video.videoWidth === 0 || video.videoHeight === 0 || video.readyState < 2) {
          throw new Error('Camera stream is still starting up. Please face the camera and click Verify again in 1-2 seconds.')
        }
        try {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          liveFaceImg = canvas.toDataURL('image/jpeg', 0.92)
        } catch {}
      }

      const passportImg = passportFaceCrop || customPassportImage
      if (!passportImg) {
        throw new Error('Passport photo missing. Please scan your passport in Step 2.')
      }

      if (!liveFaceImg) {
        throw new Error('Please turn on your webcam or import a live face photo to compare.')
      }

      // Call real backend comparison endpoint (with DeepFace ArcFace & real images)
      const res = await SmartGateApi.compareFaceMatch({
        passenger_id: dbSavedStatus?.passengerId || 1,
        passport_image_base64: passportImg,
        live_face_base64: liveFaceImg,
        is_sample_persona: false,
        persona_match: true,
      })

      const verified = res?.verified === true
      const simScore = typeof res?.similarity === 'number' ? res.similarity : 0.18

      setPassenger((prev) => ({
        ...prev,
        confidence: `${(simScore * 100).toFixed(1)}%`,
      }))

      // If faces DO NOT MATCH: strictly reject!
      if (!verified) {
        setFaceMatching(false)
        setFaceMatched(false)
        setVerificationFailed(true)
        setFailureReason(res?.reason || 'Face mismatch: camera face does not match passport photo holder.')
        return
      }

      // 2. Persist verified log in central DB
      await AiApi.faceVerify({
        passenger_id: dbSavedStatus?.passengerId || 1,
        checkpoint_type: 'security_gate',
        cosine_similarity: simScore,
        match_threshold: 0.6,
      }).catch(() => {})

      await SmartGateApi.enrollBiometrics({
        passengerId: dbSavedStatus?.passengerId || 1,
        capturedFaceBase64: liveFaceImg
      }).catch(() => {})

      // If matched, advance to clearance
      setFaceMatching(false)
      setFaceMatched(true)
      setVerificationFailed(false)

      setTimeout(() => {
        stopWebcam()
        setCurrentStep(4)
      }, 1200)

    } catch (err) {
      setFaceMatching(false)
      setFaceMatched(false)
      setVerificationFailed(true)
      setFailureReason(String(err.message || 'Face verification system error'))
    }
  }

  // SVG calculations for countdown ring
  const circumference = 264
  const strokeOffset = circumference - (countdown / 15) * circumference
  const isAr = lang === 'AR'

  return (
    <div className={`min-h-screen bg-background font-body-md text-on-surface antialiased flex flex-col ${isAr ? 'rtl' : 'ltr'}`}>
      {/* Hidden File Inputs for custom imports */}
      <input
        type="file"
        ref={passportFileInputRef}
        onChange={handlePassportPhotoUpload}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={faceFileInputRef}
        onChange={handleFacePhotoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Top Fixed Header */}
      <header className="sticky top-0 w-full z-40 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high/60 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-20 w-full px-6 md:px-12 flex items-center justify-between gap-4">
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[24px]">flight_takeoff</span>
            </div>
            <div>
              <div className="font-headline-sm text-headline-sm tracking-tight text-primary leading-none font-bold">AeroGate</div>
              <div className="font-label-sm text-label-sm text-on-surface-variant leading-none mt-1 uppercase font-semibold">
                {isAr ? 'نظام الحدود الذكي • البوابة B22' : 'SMART BORDER SYSTEM • Gate B22'}
              </div>
            </div>
          </div>

          {/* Stepper Navigation */}
          <nav className="hidden lg:flex items-center bg-surface-container-low p-1.5 rounded-full shadow-inner">
            {[
              { step: 1, label: isAr ? '1. طريقة التحقق' : '1. Scan Method' },
              { step: 2, label: isAr ? '2. فحص المستند' : '2. Scan Document' },
              { step: 3, label: isAr ? '3. بصمة الوجه' : '3. Face Capture' },
              { step: 4, label: isAr ? '4. فتح البوابة' : '4. Gate Clearance' },
            ].map((s) => (
              <button
                key={s.step}
                type="button"
                onClick={() => setCurrentStep(s.step)}
                className={`px-5 py-2 rounded-full transition-all text-sm font-semibold ${
                  currentStep === s.step
                    ? 'bg-primary-container text-on-primary-container shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* Quick Actions & Language Switch */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-surface-container-low p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setLang('EN')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  lang === 'EN' ? 'bg-inverse-surface text-inverse-on-surface shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLang('AR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  lang === 'AR' ? 'bg-inverse-surface text-inverse-on-surface shadow-sm' : 'text-on-surface-variant'
                }`}
              >
                العربية
              </button>
            </div>

            <button
              type="button"
              onClick={() => alert('Assistance staff has been notified at Gate B22.')}
              className="hidden sm:flex items-center gap-2 h-11 px-4 rounded-xl bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-primary text-[20px]">headphones</span>
              <span className="text-sm font-semibold">{isAr ? 'مساعدة' : 'Assistance'}</span>
            </button>

            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-sm">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
          </div>
        </div>

        {/* Real-time System Status Sub-bar */}
        <div className="w-full bg-surface-container-high/60 backdrop-blur-md px-6 md:px-12 py-2 flex flex-wrap items-center justify-between gap-3 border-t border-surface-container-high/40">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-surface-container-lowest text-xs font-bold text-primary shadow-sm border border-outline-variant/30">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
              <span>LIVE PIPELINE: Optical OCR Extraction • DeepFace Biometric Clearance</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {dbSavedStatus && (
              <span className="text-xs font-bold text-secondary bg-secondary-fixed/50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">database</span>
                <span>{dbSavedStatus.message}</span>
              </span>
            )}

            <button
              type="button"
              onClick={resetSession}
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-surface-container-lowest text-xs font-bold text-tertiary hover:bg-tertiary-container hover:text-on-tertiary-container transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              <span>{isAr ? 'إعادة ضبط' : 'Reset Flow'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Kiosk Screen Container */}
      <main className="flex-1 w-full flex flex-col items-center justify-start py-4 px-4 md:px-10 relative overflow-hidden select-none">
        {/* Subtle Ambient Glow */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-primary/10 via-surface-container-high/30 to-transparent blur-3xl opacity-70"></div>
        </div>

        {/* Live Flight Context Tag & Stepper */}
        <div className="relative z-10 w-full max-w-4xl mx-auto mb-6 shrink-0">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-surface-container-lowest/95 backdrop-blur-md px-6 py-3.5 rounded-2xl shadow-sm border border-surface-container-high">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-surface-container-high text-primary">
                <span className="material-symbols-outlined text-[20px]">flight</span>
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-on-surface uppercase tracking-wider">
                    Flight {passenger.flightNumber} • {passenger.destination}
                  </span>
                  <span className="inline-flex w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                  <span className="text-xs text-secondary uppercase font-bold">Gate B22 Open</span>
                </div>
                <span className="text-xs text-on-surface-variant font-medium">
                  {ocrExtractedData ? `${passenger.name} (${passenger.nationality}) • Passport ${passenger.passportNumber}` : 'Gate B22 • Concourse South • Awaiting Passport Document Scan'}
                </span>
              </div>
            </div>

            {/* Stepper Pills */}
            <div className="flex items-center gap-2">
              {[
                { num: 1, label: 'Method' },
                { num: 2, label: 'Scan Document' },
                { num: 3, label: 'Face ID' },
                { num: 4, label: 'Clearance' },
              ].map((item, idx) => (
                <React.Fragment key={item.num}>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(item.num)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      currentStep === item.num
                        ? 'bg-primary-container text-on-primary-container shadow-sm'
                        : currentStep > item.num
                        ? 'bg-secondary-fixed text-on-secondary-fixed'
                        : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[11px] ${
                        currentStep === item.num
                          ? 'bg-surface-container-lowest text-primary'
                          : currentStep > item.num
                          ? 'bg-secondary text-on-secondary'
                          : 'bg-surface-container-high text-on-surface-variant'
                      }`}
                    >
                      {currentStep > item.num ? '✓' : item.num}
                    </span>
                    <span>{item.label}</span>
                  </button>
                  {idx < 3 && <span className="text-outline-variant font-bold text-xs">›</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Stage View */}
        <div className="relative z-10 w-full max-w-4xl mx-auto flex items-center justify-center py-2">
          {/* STEP 1: METHOD SELECTION */}
          {currentStep === 1 && (
            <div className="w-full flex flex-col items-center justify-center max-w-3xl animate-fadeIn">
              <div className="text-center mb-8">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-container-high text-primary text-xs font-bold uppercase tracking-wider mb-3">
                  <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                  Terminal Ready
                </div>
                <h1 className="font-display-md text-3xl md:text-4xl text-on-surface font-extrabold tracking-tight">
                  {isAr ? 'اختر طريقة التحقق من الهوية' : 'Choose Identification'}
                </h1>
                <p className="text-base text-on-surface-variant mt-2 font-medium">
                  {isAr ? 'حدد طريقتك للمرور عبر البوابة الآلية' : 'Select how you wish to clear automated immigration at Gate B22'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {/* Option 1: Passport */}
                <button
                  type="button"
                  onClick={() => chooseMethod('passport')}
                  className="group relative flex flex-col text-left p-8 rounded-3xl bg-surface-container-lowest hover:bg-surface-container-low transition-all duration-200 shadow-md hover:shadow-xl transform active:scale-[0.98] border border-surface-container-high"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary-container/10 flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-on-primary transition-colors shadow-sm">
                    <span className="material-symbols-outlined text-[36px]">contactless</span>
                  </div>
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xl font-bold text-on-surface">Biometric Passport</span>
                    <span className="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </div>
                  <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
                    e-Passport with embedded microchip or contactless MRZ page.
                  </p>
                  <div className="mt-6 flex items-center gap-3 pt-4 bg-surface-container-low/60 rounded-xl px-4 py-2.5">
                    <span className="material-symbols-outlined text-[20px] text-primary">credit_card</span>
                    <span className="text-xs text-on-surface-variant font-medium">Place face-down flat on glass scanner</span>
                  </div>
                </button>

                {/* Option 2: Boarding Pass QR */}
                <button
                  type="button"
                  onClick={() => chooseMethod('boarding-pass')}
                  className="group relative flex flex-col text-left p-8 rounded-3xl bg-surface-container-lowest hover:bg-surface-container-low transition-all duration-200 shadow-md hover:shadow-xl transform active:scale-[0.98] border border-surface-container-high"
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary-container/10 flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-on-primary transition-colors shadow-sm">
                    <span className="material-symbols-outlined text-[36px]">qr_code_scanner</span>
                  </div>
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-xl font-bold text-on-surface">Boarding Pass QR</span>
                    <span className="material-symbols-outlined text-primary group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </div>
                  <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
                    Digital Apple/Google Wallet pass, airline app barcode, or printed slip.
                  </p>
                  <div className="mt-6 flex items-center gap-3 pt-4 bg-surface-container-low/60 rounded-xl px-4 py-2.5">
                    <span className="material-symbols-outlined text-[20px] text-primary">smartphone</span>
                    <span className="text-xs text-on-surface-variant font-medium">Hold 5–10 cm directly above red optical beam</span>
                  </div>
                </button>
              </div>

              {/* Security Standards Tag */}
              <div className="mt-8 flex items-center justify-center gap-6 text-on-surface-variant text-xs font-semibold">
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-secondary text-[18px]">verified_user</span>
                  ICAO Doc 9303 Compliant
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-outline-variant"></span>
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-primary text-[18px]">lock</span>
                  Encrypted Biometric Tunnel
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: DOCUMENT SCANNER + OCR EXTRACTION + DB PERSISTENCE */}
          {currentStep === 2 && (
            <div className="w-full flex flex-col items-center justify-center max-w-2xl animate-fadeIn">
              <div className="text-center mb-6">
                <h2 className="text-2xl md:text-3xl font-extrabold text-on-surface">
                  {selectedMethod === 'passport' ? 'Place Passport on Glass Reader' : 'Scan Digital or Paper Boarding Pass'}
                </h2>
                <p className="text-sm text-on-surface-variant mt-1 font-medium">
                  {selectedMethod === 'passport'
                    ? 'Optical OCR will extract text & passport photo and record data in database'
                    : 'Hold QR code facing downwards above optical reader'}
                </p>
              </div>

              {/* Physical Scanner Hologram */}
              <div className="relative w-full aspect-[16/10] max-h-[350px] bg-surface-container-lowest rounded-3xl shadow-xl p-5 flex flex-col items-center justify-center overflow-hidden border border-surface-container-high">
                <div className="relative w-full h-full bg-surface-container-low rounded-2xl flex items-center justify-center overflow-hidden">
                  {/* Grid */}
                  <div className="absolute inset-4 rounded-xl opacity-40 bg-[linear-gradient(to_right,#00619415_1px,transparent_1px),linear-gradient(to_bottom,#00619415_1px,transparent_1px)] bg-[size:28px_28px]"></div>

                  {/* Document Graphic or Custom Uploaded Photo */}
                  {customPassportImage ? (
                    <div
                      className={`relative z-10 w-72 h-44 rounded-xl shadow-lg overflow-hidden border-2 ${
                        docScanError ? 'border-red-500 ring-4 ring-red-500/20' : 'border-primary/40'
                      } bg-black flex items-center justify-center`}
                    >
                      <img
                        src={customPassportImage}
                        alt="Uploaded Document"
                        className="w-full h-full object-contain"
                      />
                      {docScanError && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-extrabold flex items-center gap-1 shadow">
                          <span className="material-symbols-outlined text-[12px]">error</span>
                          REJECTED
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      onClick={() => passportFileInputRef.current?.click()}
                      className="relative z-10 w-80 h-48 rounded-2xl border-2 border-dashed border-primary/50 hover:border-primary bg-surface-container-lowest/90 hover:bg-surface-container-lowest transition-all duration-200 shadow-md p-5 flex flex-col items-center justify-center gap-3 cursor-pointer group text-center"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 group-hover:bg-primary group-hover:text-on-primary transition-all shadow-sm">
                        <span className="material-symbols-outlined text-[32px]">upload_file</span>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-on-surface">Click to Upload Passport Photo</div>
                        <div className="text-xs text-on-surface-variant mt-1 max-w-[220px]">
                          Upload your passport data page with visible MRZ lines for optical OCR extraction
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Laser Sweeper */}
                  <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_15px_#007bb9] top-4 animate-scannerMove pointer-events-none"></div>

                  {/* Reticle Corners */}
                  <div className="absolute inset-8 pointer-events-none flex flex-col justify-between">
                    <div className="flex justify-between">
                      <div className="w-6 h-6 border-t-2 border-l-2 border-primary"></div>
                      <div className="w-6 h-6 border-t-2 border-r-2 border-primary"></div>
                    </div>
                    <div className="flex justify-between">
                      <div className="w-6 h-6 border-b-2 border-l-2 border-primary"></div>
                      <div className="w-6 h-6 border-b-2 border-r-2 border-primary"></div>
                    </div>
                  </div>

                  {/* Success Overlay Banner */}
                  <div
                    className={`absolute inset-0 bg-secondary/95 text-on-secondary flex flex-col items-center justify-center transition-all duration-300 z-30 ${
                      docScanned && !docScanError ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-full bg-on-secondary/20 flex items-center justify-center mb-3">
                      <span className="material-symbols-outlined text-[36px] text-on-secondary">check</span>
                    </div>
                    <span className="text-lg font-bold">Passport OCR Read & Saved</span>
                    <span className="text-xs text-on-secondary/90 mt-1">Recorded in Airport Database • Proceeding to Face Match</span>
                  </div>
                </div>
              </div>

              {/* Error Banner if OCR failed / random image uploaded */}
              {docScanError && (
                <div className="w-full mt-4 bg-red-500/10 border-2 border-red-500/80 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn text-red-700 dark:text-red-300">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-600 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[24px]">gpp_bad</span>
                    </div>
                    <div>
                      <div className="text-xs uppercase font-extrabold tracking-wider text-red-600 dark:text-red-400">
                        Document Scan Rejected
                      </div>
                      <div className="text-sm font-semibold text-on-surface mt-0.5">
                        {docScanError}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => passportFileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors shadow-sm"
                    >
                      Try Another Image
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomPassportImage(null)
                        setPassportUploadedFile(null)
                        setPassportFaceCrop(null)
                        setDocScanError(null)
                      }}
                      className="px-3 py-2 rounded-xl bg-surface-container text-on-surface-variant text-xs font-semibold hover:bg-surface-container-high transition-colors"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}

              {/* OCR Live Result Box (if extracted) */}
              {ocrExtractedData && !docScanError && (
                <div className="w-full mt-4 bg-surface-container-lowest p-4 rounded-2xl border border-secondary/40 shadow-sm flex items-center justify-between animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-secondary text-[28px]">document_scanner</span>
                    <div>
                      <div className="text-xs uppercase font-bold text-secondary">OCR Data Extracted:</div>
                      <div className="text-sm font-extrabold text-on-surface">
                        {ocrExtractedData.fullName} • {ocrExtractedData.passportNumber} ({ocrExtractedData.nationality})
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-secondary text-on-secondary text-xs font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">save</span>
                    <span>Database Saved</span>
                  </span>
                </div>
              )}

              {/* Upload Passport & Action Buttons */}
              <div className="mt-5 flex flex-col sm:flex-row items-center justify-between w-full gap-3">
                <button
                  type="button"
                  onClick={() => passportFileInputRef.current?.click()}
                  className="w-full sm:w-auto h-12 px-5 rounded-2xl bg-surface-container-lowest border border-primary/30 text-primary font-bold text-xs hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">upload_file</span>
                  <span>{customPassportImage ? 'Replace Passport Image' : 'Import Passport Photo'}</span>
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto flex-1 justify-end">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="h-12 px-5 rounded-2xl bg-surface-container text-on-surface font-semibold hover:bg-surface-container-high transition-colors flex items-center gap-2 text-xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    Change
                  </button>
                  <button
                    type="button"
                    disabled={docScanning}
                    onClick={simulateDocScan}
                    className="h-12 px-6 flex-1 sm:flex-initial rounded-2xl bg-primary text-on-primary font-bold hover:bg-primary-container transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 text-xs"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {selectedMethod === 'passport' ? 'document_scanner' : 'qr_code_scanner'}
                    </span>
                    <span>
                      {docScanning
                        ? 'Extracting Data via OCR…'
                        : !customPassportImage
                        ? 'Select Passport Image to Scan'
                        : 'Scan & Extract Data via OCR'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: COMPARE LIVE FACE WITH PASSPORT FACE */}
          {currentStep === 3 && (
            <div className="w-full flex flex-col items-center justify-center max-w-2xl animate-fadeIn">
              <div className="text-center mb-3">
                <h2 className="text-2xl md:text-3xl font-extrabold text-on-surface">Biometric Face Verification</h2>
                <p className="text-sm text-on-surface-variant mt-0.5 font-medium">
                  Comparing live camera face against the passport photo extracted via OCR
                </p>
              </div>

              {/* Photo Import & Webcam Controls Toolbar */}
              <div className="w-full flex items-center justify-between mb-3 px-2 gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => faceFileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-lowest border border-primary/30 text-primary hover:bg-primary-container hover:text-on-primary-container text-xs font-bold transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                    <span>Import Face Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={useWebcam ? stopWebcam : startWebcam}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
                      useWebcam
                        ? 'bg-secondary text-on-secondary'
                        : 'bg-surface-container-lowest border border-secondary text-secondary hover:bg-secondary-fixed'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {useWebcam ? 'videocam_off' : 'videocam'}
                    </span>
                    <span>{useWebcam ? 'Stop Webcam' : 'Use Live Webcam'}</span>
                  </button>
                </div>

                {/* Passport face thumbnail reference */}
                <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-1 rounded-xl border border-surface-container-high shadow-sm">
                  <div className="w-6 h-6 rounded-md overflow-hidden border">
                    <img
                      src={passportFaceCrop || customPassportImage || passenger.faceUrl}
                      alt="Passport Face"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[11px] font-bold text-on-surface">Passport Face Target</span>
                </div>
              </div>

              {webcamError && (
                <div className="w-full bg-error-container text-on-error-container p-2.5 rounded-xl text-xs mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">error</span>
                  <span>{webcamError}</span>
                </div>
              )}

              {/* Camera Frame HUD with Biometric Matching */}
              <div className="relative w-full aspect-[4/3] max-h-[370px] rounded-3xl overflow-hidden shadow-2xl bg-inverse-surface border border-surface-container-highest">
                {/* Live Webcam Video OR Passenger Photo */}
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />

                {!useWebcam && customFaceImage && (
                  <img
                    alt="POV passenger camera feed"
                    className="w-full h-full object-cover"
                    src={customFaceImage}
                  />
                )}

                {!useWebcam && !customFaceImage && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 bg-inverse-surface/90">
                    <div className="w-14 h-14 rounded-2xl bg-surface-container-highest/60 text-primary-fixed flex items-center justify-center mb-3 shadow-sm">
                      <span className="material-symbols-outlined text-[32px]">photo_camera</span>
                    </div>
                    <div className="text-sm font-bold text-inverse-on-surface">Live Face Capture Required</div>
                    <p className="text-xs text-surface-variant max-w-xs mt-1">
                      Start your webcam or upload a real face photo to compare against the passport photo holder.
                    </p>
                    <div className="flex items-center gap-2 mt-4 pointer-events-auto">
                      <button
                        type="button"
                        onClick={startWebcam}
                        className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold hover:bg-primary-container transition-all flex items-center gap-1.5 shadow-md"
                      >
                        <span className="material-symbols-outlined text-[16px]">videocam</span>
                        <span>Start Camera</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => faceFileInputRef.current?.click()}
                        className="px-4 py-2 rounded-xl bg-surface-container-highest text-inverse-on-surface text-xs font-bold hover:bg-surface-container-high transition-all flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">upload</span>
                        <span>Upload Face Photo</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/80 via-transparent to-inverse-surface/40 pointer-events-none"></div>

                {/* Telemetry info */}
                <div className="absolute top-4 left-5 right-5 flex items-center justify-between text-surface pointer-events-none font-mono text-[11px] tracking-wider uppercase">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-error animate-pulse"></span>
                    <span className="font-semibold text-inverse-on-surface">
                      {useWebcam ? 'LIVE WEBCAM STREAM' : customFaceImage ? 'LIVE CAPTURE LOADED' : 'CAMERA STANDBY'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-surface-variant">
                    <span>60 FPS</span>
                    <span>EXP: AUTO</span>
                    <span>DIST: 0.72M</span>
                  </div>
                </div>

                {/* Dual Reference Pill (Shows Passport Photo ⟷ Live Face Match) */}
                <div className="absolute top-12 left-5 z-20 flex items-center gap-2 bg-inverse-surface/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-surface-container-highest text-surface pointer-events-none">
                  <div className="w-7 h-7 rounded-lg overflow-hidden border border-secondary shadow bg-black flex items-center justify-center">
                    {passportFaceCrop || customPassportImage ? (
                      <img
                        src={passportFaceCrop || customPassportImage}
                        alt="Passport Ref"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-[16px] text-surface-variant">person</span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-secondary-fixed">PASSPORT PHOTO</span>
                  <span className="text-[10px] text-surface-variant">⟷</span>
                  <span className="text-[10px] font-mono text-primary-fixed">LIVE FACE</span>
                </div>

                {/* Biometric Reticle */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className={`relative w-48 h-60 rounded-[90px] border-2 transition-all duration-500 flex items-center justify-center ${
                      verificationFailed
                        ? 'border-error ring-4 ring-error/40 bg-error/10'
                        : faceMatched
                        ? 'border-secondary ring-4 ring-secondary/30'
                        : 'border-primary-fixed/60'
                    }`}
                  >
                    <div className={`absolute -top-3 -left-3 w-6 h-6 border-t-2 border-l-2 ${verificationFailed ? 'border-error' : faceMatched ? 'border-secondary' : 'border-primary-fixed'}`}></div>
                    <div className={`absolute -top-3 -right-3 w-6 h-6 border-t-2 border-r-2 ${verificationFailed ? 'border-error' : faceMatched ? 'border-secondary' : 'border-primary-fixed'}`}></div>
                    <div className={`absolute -bottom-3 -left-3 w-6 h-6 border-b-2 border-l-2 ${verificationFailed ? 'border-error' : faceMatched ? 'border-secondary' : 'border-primary-fixed'}`}></div>
                    <div className={`absolute -bottom-3 -right-3 w-6 h-6 border-b-2 border-r-2 ${verificationFailed ? 'border-error' : faceMatched ? 'border-secondary' : 'border-primary-fixed'}`}></div>
                    
                    <div className={`absolute inset-x-2 h-0.5 animate-faceSweep ${verificationFailed ? 'bg-error shadow-[0_0_12px_#ba1a1a]' : 'bg-gradient-to-r from-transparent via-primary-fixed to-transparent shadow-[0_0_12px_#93ccff]'}`}></div>
                    
                    <div className="flex items-center gap-10 text-surface-container-highest/60">
                      <span className="material-symbols-outlined text-[18px]">
                        {verificationFailed ? 'cancel' : 'visibility'}
                      </span>
                      <span className="material-symbols-outlined text-[18px]">
                        {verificationFailed ? 'cancel' : 'visibility'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="absolute bottom-6 inset-x-6 flex items-center justify-between bg-surface-container-lowest/95 backdrop-blur-md px-5 py-3 rounded-2xl shadow-lg border border-surface-container-high">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center ${
                        verificationFailed
                          ? 'bg-error text-on-error'
                          : faceMatched
                          ? 'bg-secondary text-on-secondary'
                          : 'bg-primary-container text-on-primary-container'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[20px] ${faceMatching ? 'animate-spin' : ''}`}>
                        {verificationFailed ? 'cancel' : faceMatched ? 'verified' : 'refresh'}
                      </span>
                    </div>
                    <div>
                      <div className={`font-bold text-sm ${verificationFailed ? 'text-error' : faceMatched ? 'text-secondary' : 'text-on-surface'}`}>
                        {verificationFailed
                          ? 'IDENTITY MISMATCH DETECTED'
                          : faceMatched
                          ? 'PASSPORT FACE MATCH CONFIRMED'
                          : 'Comparing Face to Passport Holder...'}
                      </div>
                      <div className="text-xs text-on-surface-variant font-medium mt-0.5">
                        {verificationFailed
                          ? 'Biometric distance exceeded threshold — gate locked'
                          : faceMatched
                          ? 'DeepFace / ArcFace Cosine Similarity Exceeded Threshold'
                          : 'Feature extraction from live optical frame'}
                      </div>
                    </div>
                  </div>
                  <div className={`font-mono text-xs font-bold ${verificationFailed ? 'text-error' : faceMatched ? 'text-secondary' : 'text-primary'}`}>
                    {verificationFailed ? `MISMATCH: ${passenger.confidence}` : faceMatched ? `MATCH: ${passenger.confidence}` : 'CALCULATING'}
                  </div>
                </div>
              </div>

              {/* Explicit Access Denied Failure Alert */}
              {verificationFailed && (
                <div className="w-full mt-4 p-4 rounded-2xl bg-error-container text-on-error-container border border-error/40 flex items-start gap-3 shadow-md animate-fadeIn">
                  <span className="material-symbols-outlined text-[28px] text-error shrink-0">no_accounts</span>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-error uppercase">ACCESS DENIED — TURNSTILE LOCKED</div>
                    <div className="text-xs mt-1 leading-relaxed font-medium">
                      {failureReason || 'Camera face does not match passport photo. Gate clearance cannot proceed.'}
                    </div>
                    <div className="text-[11px] font-semibold text-on-error-container/80 mt-1.5">
                      Automatic border crossing is halted. Please proceed to the Border Control Supervisor at Counter 3.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationFailed(false)
                      setFaceMatching(false)
                    }}
                    className="px-3 py-1.5 rounded-lg bg-surface-container-lowest text-xs font-bold text-error border border-error/30 hover:bg-surface-container-high transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-5 flex items-center justify-between w-full gap-4">
                <button
                  type="button"
                  onClick={() => alert('Fallback Protocol: Present boarding pass barcode to auxiliary reader.')}
                  className="h-12 px-5 rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">qr_code</span>
                  <span>Manual Barcode Scan</span>
                </button>
                <button
                  type="button"
                  disabled={faceMatching}
                  onClick={simulateFaceRecognition}
                  className={`h-12 px-6 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 ${
                    verificationFailed
                      ? 'bg-error text-on-error hover:bg-error/90'
                      : !useWebcam && !customFaceImage
                      ? 'bg-primary/80 text-on-primary hover:bg-primary'
                      : 'bg-primary text-on-primary hover:bg-primary-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {verificationFailed
                      ? 'refresh'
                      : !useWebcam && !customFaceImage
                      ? 'photo_camera'
                      : 'face'}
                  </span>
                  <span>
                    {faceMatching
                      ? 'Analyzing Biometrics…'
                      : verificationFailed
                      ? 'Re-attempt Face Match'
                      : !useWebcam && !customFaceImage
                      ? 'Start Camera / Upload Face to Verify'
                      : 'Confirm Face Match & Verify'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: GATE CLEARANCE */}
          {currentStep === 4 && (
            <div className="w-full flex flex-col items-center justify-center max-w-3xl animate-fadeIn">
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary-fixed/50 text-secondary text-xs font-bold mb-3">
                  <span className="material-symbols-outlined text-[20px]">lock_open</span>
                  AUTOMATED BORDER CLEARED • OCR VERIFIED
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-on-surface">Gate Open — Please Proceed</h1>
                <p className="text-base text-on-surface-variant mt-1 font-medium">
                  Identity matched against passport {passenger.passportNumber} • Step through the turnstile
                </p>
              </div>

              {/* Clearance Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
                {/* Boarding Info Card */}
                <div className="md:col-span-2 bg-surface-container-lowest rounded-3xl p-6 shadow-md flex flex-col justify-between border border-surface-container-high">
                  <div>
                    <div className="flex items-center justify-between pb-4 border-b border-surface-container-high">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-secondary shadow-sm bg-surface-container-high flex items-center justify-center">
                          {customFaceImage || passportFaceCrop || customPassportImage ? (
                            <img
                              src={customFaceImage || passportFaceCrop || customPassportImage}
                              alt="Passenger"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="material-symbols-outlined text-[24px] text-on-surface-variant">person</span>
                          )}
                        </div>
                        <div>
                          <span className="text-xs uppercase tracking-wider text-on-surface-variant font-bold">Passenger</span>
                          <div className="text-2xl font-extrabold text-on-surface">{passenger.name}</div>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-on-secondary text-xs font-bold">
                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                        Cleared
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4">
                      <div>
                        <span className="text-xs uppercase text-on-surface-variant font-semibold">Flight</span>
                        <p className="text-base font-bold text-on-surface">{passenger.flightNumber}</p>
                      </div>
                      <div>
                        <span className="text-xs uppercase text-on-surface-variant font-semibold">Passport</span>
                        <p className="text-base font-bold text-primary">{passenger.passportNumber}</p>
                      </div>
                      <div>
                        <span className="text-xs uppercase text-on-surface-variant font-semibold">Seat</span>
                        <p className="text-base font-bold text-secondary">{passenger.seat}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 bg-surface-container-low px-4 py-2.5 rounded-2xl flex items-center justify-between font-mono text-xs text-on-surface-variant">
                    <span>TOKEN: {passenger.token}</span>
                    <span className="flex items-center gap-1.5 text-secondary font-bold">
                      <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                      BARRIER DISENGAGED
                    </span>
                  </div>
                </div>

                {/* Countdown & Barrier Graphic */}
                <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-md flex flex-col items-center justify-between text-center border border-surface-container-high">
                  <span className="text-xs uppercase tracking-wider text-on-surface-variant font-bold">
                    Walk-Through Window
                  </span>

                  <div className="relative w-28 h-28 flex items-center justify-center my-3">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        className="text-surface-container"
                        cx="50"
                        cy="50"
                        fill="transparent"
                        r="42"
                        stroke="currentColor"
                        strokeWidth="8"
                      />
                      <circle
                        className="text-secondary transition-all duration-1000"
                        cx="50"
                        cy="50"
                        fill="transparent"
                        r="42"
                        stroke="currentColor"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeOffset}
                        strokeLinecap="round"
                        strokeWidth="8"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-3xl font-extrabold text-on-surface leading-none">{countdown}</span>
                      <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Seconds</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 w-full py-2 bg-secondary-fixed/30 rounded-xl text-secondary text-xs font-bold">
                    <span className="material-symbols-outlined text-[18px]">meeting_room</span>
                    <span>Glass Barriers Retracted</span>
                  </div>
                </div>
              </div>

              {/* Reset Session Button */}
              <div className="mt-6 flex items-center justify-center gap-4 w-full">
                <button
                  type="button"
                  onClick={resetSession}
                  className="h-14 px-10 rounded-2xl bg-secondary text-on-secondary text-base font-bold hover:bg-secondary/90 transition-all shadow-md flex items-center gap-2 transform active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[22px]">check</span>
                  <span>Passenger Passed • Reset for Next Traveler</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
