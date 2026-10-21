import React, { useState, useEffect, useRef } from 'react'
import { SmartGateApi } from '../services/api'

export default function GateBoarding() {
  const [currentState, setCurrentState] = useState(1)
  const [currentLang, setCurrentLang] = useState('EN')
  const [secondsRemaining, setSecondsRemaining] = useState(10)
  const [isAssistModalOpen, setIsAssistModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [webcamActive, setWebcamActive] = useState(false)
  const [webcamError, setWebcamError] = useState(null)
  const [scanError, setScanError] = useState(null)
  const [enrollSuccess, setEnrollSuccess] = useState(null)
  const [uploadedFacePreview, setUploadedFacePreview] = useState(null)
  const [personaMode, setPersonaMode] = useState('real') // 'real', 'wrong_flight', 'unknown'

  const [passengerData, setPassengerData] = useState({
    name: 'JOHNATHAN DOE',
    flightNumber: 'QR-082',
    seat: '24A',
    zone: 'ZONE 2',
    gate: 'GATE B22',
    destination: 'Doha Intl (DOH)',
    matchConfidence: 99.4,
    baggage: '2 / 2 Loaded (Holds A-04)',
    pathway: 'Jetbridge Open (Door 2L Direct)'
  })

  // DOM Refs
  const timerRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)

  const translations = {
    EN: {
      gateTitle: "GATE B22",
      flightLabel: "QR-082 • Doha (DOH)",
      s1Pill: "SECURE IDENTITY VERIFICATION",
      s1Title: "Look Directly into the Camera",
      s1Sub: "Matching live facial biometrics against Flight QR-082 passenger database.",
      s2Cleared: "PASSENGER CLEARED FOR BOARDING",
      s2Title: `Welcome Aboard, ${passengerData.name}`,
      s2Instruction: "e-Gate Barriers Opening • Please Proceed Through Gate B22",
      s3Badge: "BOARDING NOT AUTHORIZED AT THIS GATE",
      s3Title: "Access Denied: Wrong Departure Gate",
      s3Sub: "You are not registered on the passenger manifest for Flight QR-082 (Doha).",
      s4Title: "Scan Boarding Pass",
      s4Sub: "Place your digital mobile pass or printed paper barcode face-down on the reader glass."
    },
    AR: {
      gateTitle: "بوابة B22",
      flightLabel: "QR-082 • الدوحة (DOH)",
      s1Pill: "التحقق الآمن من الهوية الحيوية",
      s1Title: "يرجى النظر مباشرة إلى الكاميرا",
      s1Sub: "جارٍ مطابقة بصمة الوجه الحيوية مع سجل المسافرين للرحلة QR-082.",
      s2Cleared: "تمت الموافقة على صعود الطائرة",
      s2Title: `أهلاً بك على متن الطائرة، ${passengerData.name}`,
      s2Instruction: "بوابات الصعود الإلكترونية تفتح الآن • يرجى العبور عبر بوابة B22",
      s3Badge: "غير مصرح بالصعود من هذه البوابة",
      s3Title: "تم رفض العبور: البوابة غير صحيحة",
      s3Sub: "أنت غير مسجل في قائمة المسافرين لرحلة الدوحة QR-082.",
      s4Title: "امسح بطاقة صعود الطائرة",
      s4Sub: "ضع رمز بطاقة الصعود الرقمية أو الورقية مقلوباً على ماسح القراءة الضوئي."
    }
  }

  const t = translations[currentLang]

  // Webcam activation
  const startWebcam = async () => {
    setWebcamError(null)
    setScanError(null)
    setUploadedFacePreview(null)

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setWebcamError('Camera API not supported or requires localhost/HTTPS context. Please use "Upload Test Face" below.')
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
        // Fallback for simple/virtual webcams
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        })
      }

      streamRef.current = stream
      setWebcamActive(true)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play().catch(() => {})
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(() => {})
        }
      }
    } catch (err) {
      console.warn('Webcam start error:', err)
      let msg = 'Camera access denied or unavailable.'
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission denied! Click the lock/camera icon in your address bar and allow camera access.'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera found on this computer. You can use "Upload Test Face" below.'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is in use by another program. Please close other camera apps and retry.'
      }
      setWebcamError(msg)
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

  // Whenever returning to State 1 (Next Passenger or auto-close), ensure live camera is active and attached
  useEffect(() => {
    if (currentState === 1) {
      setUploadedFacePreview(null)
      setScanError(null)

      const attachOrStart = async () => {
        const stream = streamRef.current
        const hasLiveTrack = stream && stream.active && stream.getVideoTracks().some(tr => tr.readyState === 'live')

        if (hasLiveTrack) {
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            try {
              await videoRef.current.play()
            } catch (e) {
              console.warn('Video play error on reattach:', e)
            }
          }
          setWebcamActive(true)
        } else {
          await startWebcam()
        }
      }

      const tId = setTimeout(() => {
        attachOrStart()
      }, 50)

      return () => clearTimeout(tId)
    }
  }, [currentState])

  useEffect(() => {
    startWebcam()
    return () => {
      stopWebcam()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Capture current frame from video tag
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

  // Handle manual photo upload for testing
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      stopWebcam()
      setScanError(null)
      const reader = new FileReader()
      reader.onload = (ev) => {
        setUploadedFacePreview(ev.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  // ENROLL CURRENT CAMERA/UPLOADED FACE INTO DATABASE
  const handleEnrollCurrentFace = async () => {
    const frame = captureFrame()
    if (!frame) {
      setScanError('Please turn on your camera or choose a photo first.')
      return
    }
    setLoading(true)
    setScanError(null)
    setEnrollSuccess(null)
    try {
      const res = await SmartGateApi.enrollGateFace({
        capturedFrameBase64: frame,
        passengerId: 4,
        flightNumber: 'QR-082'
      })
      if (res.success) {
        setEnrollSuccess(res.message || 'Face photo successfully linked to Yehia (QR-082) in database!')
        setTimeout(() => setEnrollSuccess(null), 5000)
      } else {
        setScanError(res.message || 'Enrollment failed.')
      }
    } catch (err) {
      setScanError(err.message || 'Failed to enroll face.')
    } finally {
      setLoading(false)
    }
  }

  // REAL Face Verification Check (Not Hardcoded!)
  const handleVerifyFace = async () => {
    setLoading(true)
    setScanError(null)

    const frame = captureFrame()

    // If camera is off and no photo uploaded in real mode
    if (personaMode === 'real' && !frame) {
      setScanError('Camera is offline. Please click "Turn On Live Camera" or "Upload Test Face" to verify your identity.')
      setLoading(false)
      return
    }

    try {
      const res = await SmartGateApi.verifyAndBoard({
        capturedFrameBase64: frame,
        flightNumber: 'QR-082',
        boardingGateId: 22,
        testPassengerMode: personaMode
      })

      if (res.cleared && res.state === 2) {
        // PASS -> State 2 (Cleared)
        setPassengerData(prev => ({
          ...prev,
          name: res.passengerName || 'JOHNATHAN DOE',
          flightNumber: res.flightNumber || 'QR-082',
          seat: res.seatNumber || '24A',
          zone: res.group || 'ZONE 2',
          matchConfidence: res.biometricMatchScore || 99.4,
        }))
        setCurrentState(2)

        // Start 10-second auto-close timer
        setSecondsRemaining(10)
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = setInterval(() => {
          setSecondsRemaining(prev => {
            if (prev <= 1) {
              clearInterval(timerRef.current)
              handleNextPassenger()
              return 10
            }
            return prev - 1
          })
        }, 1000)
      } else if (res.state === 3 || res.verificationResult === 'flight_mismatch') {
        // FAIL -> State 3 (Wrong Flight)
        setCurrentState(3)
      } else {
        // FAIL -> Face not found or no face
        setScanError(res.message || 'Face Not Recognized: Your biometric identity was not found in the Flight QR-082 passenger manifest. Turnstile remains locked.')
      }
    } catch (err) {
      setScanError(err.message || 'Verification service unreachable.')
    } finally {
      setLoading(false)
    }
  }

  // Clean transition to Next Passenger: resets photo upload, errors, and reopens camera
  const handleNextPassenger = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setSecondsRemaining(10)
    setScanError(null)
    setEnrollSuccess(null)
    setUploadedFacePreview(null)
    setCurrentState(1)
  }

  const handleStateTransition = (stateNum) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setScanError(null)
    setEnrollSuccess(null)
    if (stateNum === 1) {
      handleNextPassenger()
      return
    }
    setCurrentState(stateNum)

    if (stateNum === 2) {
      setSecondsRemaining(10)
      timerRef.current = setInterval(() => {
        setSecondsRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            handleNextPassenger()
            return 10
          }
          return prev - 1
        })
      }, 1000)
    }
  }

  const handleToolbarState = handleStateTransition

  return (
    <div className="bg-[#faf8ff] text-[#131b2e] min-h-screen flex flex-col justify-between selection:bg-[#006194] selection:text-white" dir={currentLang === 'AR' ? 'rtl' : 'ltr'}>
      {/* Top Header */}
      <header className="w-full bg-[#faf8ff]/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-[#dae2fd]">
        <div className="h-20 w-full px-6 lg:px-10 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#006194] text-white flex items-center justify-center font-bold text-lg shadow-sm">
                ✈
              </div>
              <span className="font-bold text-xl tracking-tight text-[#131b2e]">AeroGate</span>
            </div>
            <div className="h-6 w-[1px] bg-[#dae2fd] hidden sm:block"></div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded bg-[#006194] text-white font-bold text-sm tracking-wide">
                {t.gateTitle}
              </span>
              <div className="flex items-center gap-2 text-sm text-[#4a5a75]">
                <span className="font-semibold text-[#131b2e]">{t.flightLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Language Switcher */}
            <div className="flex items-center bg-[#eaedff] rounded-full p-1 shadow-sm">
              <button
                type="button"
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${currentLang === 'EN' ? 'bg-[#131b2e] text-white shadow-sm' : 'text-[#4a5a75] hover:text-[#131b2e]'}`}
                onClick={() => setCurrentLang('EN')}
              >
                EN
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${currentLang === 'AR' ? 'bg-[#131b2e] text-white shadow-sm' : 'text-[#4a5a75] hover:text-[#131b2e]'}`}
                onClick={() => setCurrentLang('AR')}
              >
                العربية
              </button>
            </div>

            {/* Assistance Button */}
            <button
              onClick={() => setIsAssistModalOpen(true)}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-xl bg-white text-[#131b2e] hover:bg-[#eaedff] transition-all shadow-[0_1px_8px_rgba(0,0,0,0.04)] active:scale-[0.98] border border-[#bfc7d2]/40"
              type="button"
            >
              <span className="text-sm font-bold hidden md:inline">Call Assistance</span>
            </button>
          </div>
        </div>
      </header>



      {/* Main Viewport Container */}
      <main className="w-full flex-1 flex flex-col justify-center items-center px-6 py-6">
        <div className="w-full max-w-5xl mx-auto flex flex-col justify-center items-center">
          
          {/* ========================================================================= */}
          {/* STATE 1: LIVE BIOMETRIC CAMERA SCAN */}
          {/* ========================================================================= */}
          {currentState === 1 && (
            <div className="w-full max-w-4xl flex flex-col items-center justify-between py-2 transition-all duration-300">
              <div className="text-center max-w-xl mx-auto space-y-1 mb-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#dae2fd] text-[#006194] text-xs font-bold tracking-wide mb-1">
                  <span className="w-2 h-2 rounded-full bg-[#006194] animate-ping"></span>
                  <span>{t.s1Pill}</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-[#131b2e] tracking-tight">{t.s1Title}</h1>
                <p className="text-base text-[#4a5a75]" dangerouslySetInnerHTML={{ __html: t.s1Sub }}></p>
              </div>

              {/* Error Banner when check fails or no face detected */}
              {scanError && (
                <div className="w-full max-w-md bg-[#ffdad6] border border-[#ba1a1a]/30 text-[#ba1a1a] px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center gap-2 my-2 shadow-sm animate-shake">
                  <span className="text-base font-bold">⚠️</span>
                  <span>{scanError}</span>
                </div>
              )}

              {/* Success Banner when Face Enrolled */}
              {enrollSuccess && (
                <div className="w-full max-w-md bg-[#6cf8bb]/20 border border-[#006c49]/40 text-[#006c49] px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 my-2 shadow-sm animate-fadeIn">
                  <span className="text-base">✓</span>
                  <span>{enrollSuccess}</span>
                </div>
              )}

              {/* Live HUD Box */}
              <div className="relative w-full max-w-md h-[400px] rounded-3xl overflow-hidden shadow-2xl bg-[#090d16] flex items-center justify-center my-2 border border-[#bfc7d2]/30">
                
                {/* 1. HTML5 Video Tag */}
                <video
                  ref={(el) => {
                    videoRef.current = el
                    if (el && streamRef.current && streamRef.current.active) {
                      if (el.srcObject !== streamRef.current) {
                        el.srcObject = streamRef.current
                        el.play().catch(() => {})
                      }
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] z-0 ${
                    webcamActive && !uploadedFacePreview ? 'block' : 'hidden'
                  }`}
                />

                {/* 2. Uploaded Photo Preview if chosen */}
                {uploadedFacePreview && (
                  <img
                    alt="Uploaded Passenger Face"
                    src={uploadedFacePreview}
                    className="absolute inset-0 w-full h-full object-cover z-0"
                  />
                )}

                {/* 3. Dark Futuristic Camera Standby Screen */}
                {!webcamActive && !uploadedFacePreview && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#0b1220] via-[#10192e] to-[#070b14] p-6 text-center z-0">
                    <div className="w-16 h-16 rounded-full bg-[#006194]/20 border border-[#006194]/40 flex items-center justify-center text-3xl text-[#93ccff] mb-3 animate-pulse">
                      📷
                    </div>
                    <div className="text-white font-bold text-base mb-1">Camera Standby</div>
                    <p className="text-xs text-[#93ccff]/80 max-w-xs mb-4">
                      {webcamError || 'Click below to stream live video from your device.'}
                    </p>
                    <button
                      type="button"
                      onClick={startWebcam}
                      className="px-5 py-2.5 rounded-xl bg-[#006194] hover:bg-[#007bb9] text-white text-xs font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2"
                    >
                      <span>Turn On Live Camera</span>
                    </button>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-[#090d16] via-transparent to-[#090d16]/70 pointer-events-none z-10"></div>

                {/* Diagnostics Header */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-xs font-mono text-white/90 pointer-events-none z-20">
                  <div className="flex items-center gap-2 bg-[#131b2e]/85 px-2.5 py-1 rounded-md backdrop-blur-md border border-white/10">
                    <span className={`w-2 h-2 rounded-full ${webcamActive ? 'bg-[#006c49] animate-pulse' : 'bg-[#da3437]'}`}></span>
                    <span className="font-bold">
                      {webcamActive ? 'LIVE [GATE-CAM-B22]' : 'STANDBY [GATE-CAM-B22]'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#131b2e]/85 px-2.5 py-1 rounded-md backdrop-blur-md border border-white/10">
                    <span>{webcamActive ? '60 FPS' : 'IDLE'}</span>
                    <span>•</span>
                    <span>FOCAL: 1.45m</span>
                  </div>
                </div>

                {/* Scanning Reticle */}
                <div className="relative z-20 w-64 h-80 flex flex-col items-center justify-center pointer-events-none">
                  {/* Outer Frame Brackets */}
                  <div className="absolute inset-0 flex flex-col justify-between">
                    <div className="flex justify-between w-full">
                      <div className="w-7 h-7 border-t-4 border-l-4 border-[#93ccff] rounded-tl-xl shadow-sm"></div>
                      <div className="w-7 h-7 border-t-4 border-r-4 border-[#93ccff] rounded-tr-xl shadow-sm"></div>
                    </div>
                    <div className="flex justify-between w-full">
                      <div className="w-7 h-7 border-b-4 border-l-4 border-[#93ccff] rounded-bl-xl shadow-sm"></div>
                      <div className="w-7 h-7 border-b-4 border-r-4 border-[#93ccff] rounded-br-xl shadow-sm"></div>
                    </div>
                  </div>

                  {/* Oval Contour */}
                  <div className="w-48 h-64 rounded-[48%] border-2 border-dashed border-[#93ccff]/80 flex items-center justify-center relative overflow-hidden backdrop-brightness-110 shadow-[0_0_20px_rgba(0,97,148,0.4)]">
                    <div className={`absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#6cf8bb] to-transparent shadow-[0_0_15px_rgba(111,251,190,0.9)] ${loading ? 'animate-bounce' : 'animate-pulse'}`}></div>
                    <div className="text-center px-4">
                      <div className="text-[11px] font-bold text-white tracking-wider uppercase bg-[#131b2e]/70 px-3 py-1 rounded-full border border-white/20">
                        {loading ? 'Analyzing Biometrics...' : 'Keep Face Centered'}
                      </div>
                    </div>
                  </div>

                  <div className="absolute -bottom-2 bg-[#006194] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 shadow-lg">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                    <span>{loading ? 'Matching with Flight Manifest...' : 'Querying Passenger Manifest...'}</span>
                  </div>
                </div>

                {/* Bottom Distance Cue */}
                <div className="absolute bottom-3 left-6 right-6 flex items-center justify-between text-[11px] font-medium text-white/80 z-20 pointer-events-none">
                  <span>Optimal: 0.6m - 1.2m</span>
                  <span className="text-[#6cf8bb] font-bold">Lighting Ideal</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full max-w-md flex flex-col items-center gap-2.5 mt-2">
                {/* REAL Check Button */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleVerifyFace}
                  className="w-full h-14 rounded-2xl bg-[#006194] text-white hover:bg-[#007bb9] active:scale-[0.98] transition-all flex items-center justify-center gap-3 font-bold text-base shadow-md disabled:opacity-60"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Verifying Biometric Face...</span>
                    </span>
                  ) : (
                    <span>Scan Face &amp; Verify Gate Access</span>
                  )}
                </button>

                <div className="w-full flex items-center justify-between gap-2 px-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-semibold text-[#4a5a75] hover:text-[#006194] flex items-center gap-1 py-1"
                  >
                    <span>📁 Upload Test Face</span>
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleEnrollCurrentFace}
                    className="text-xs font-bold text-[#006c49] bg-[#6cf8bb]/20 px-2.5 py-1 rounded-lg hover:bg-[#6cf8bb]/40 transition-colors flex items-center gap-1"
                  >
                    <span>📸 Enroll Face to DB</span>
                  </button>

                  {!webcamActive ? (
                    <button
                      type="button"
                      onClick={startWebcam}
                      className="text-xs font-semibold text-[#006194] hover:underline flex items-center gap-1 py-1"
                    >
                      <span>📷 Turn On Camera</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopWebcam}
                      className="text-xs font-semibold text-[#ba1a1a] hover:underline flex items-center gap-1 py-1"
                    >
                      <span>⏹ Stop Camera</span>
                    </button>
                  )}
                </div>


                <button
                  type="button"
                  onClick={() => handleToolbarState(4)}
                  className="text-sm font-semibold text-[#006194] hover:underline flex items-center gap-1.5 py-1.5 transition-colors"
                >
                  <span>Manual Check: Scan Barcode / Boarding Pass</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE 2: BOARDING APPROVED & GATE OPEN (SUCCESS) */}
          {/* ========================================================================= */}
          {currentState === 2 && (
            <div className="w-full max-w-3xl flex flex-col items-center justify-between py-2 transition-all duration-300">
              <div className="w-full text-center space-y-1 mb-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#6cf8bb]/30 text-[#006c49] text-sm font-bold shadow-sm border border-[#006c49]/20">
                  <span>✓ {t.s2Cleared}</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-[#131b2e] tracking-tight">{t.s2Title}</h1>
                <p className="text-lg font-semibold text-[#006c49]">{t.s2Instruction}</p>
              </div>

              {/* Boarding Card Receipt */}
              <div className="w-full bg-white rounded-3xl p-6 shadow-xl flex flex-col gap-6 relative overflow-hidden border border-[#dae2fd]">
                <div className="absolute top-0 left-0 right-0 h-2 bg-[#006c49]"></div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 bg-[#f2f3ff]/60 rounded-2xl p-4">
                  <div>
                    <div className="text-xs uppercase font-bold tracking-wider text-[#4a5a75]">Confirmed Passenger</div>
                    <div className="text-2xl font-bold text-[#131b2e]">{passengerData.name}</div>
                    <div className="text-xs text-[#707881] flex items-center gap-2 mt-0.5">
                      <span>MANIF-ID: #QR82-004928</span>
                      <span>•</span>
                      <span className="text-[#006c49] font-bold">Biometric Match: {passengerData.matchConfidence}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-xl shadow-sm border border-[#dae2fd]">
                    <div className="text-right">
                      <div className="text-xs uppercase font-bold text-[#4a5a75]">Assigned Seat</div>
                      <div className="text-3xl font-extrabold text-[#006194]">{passengerData.seat}</div>
                    </div>
                    <div className="h-8 w-[1px] bg-[#dae2fd]"></div>
                    <div>
                      <div className="text-xs uppercase font-bold text-[#4a5a75]">Boarding</div>
                      <div className="text-base font-bold text-[#131b2e]">{passengerData.zone}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-[#f2f3ff] p-3.5 rounded-xl border border-[#dae2fd]/60">
                    <div className="text-[11px] font-bold text-[#4a5a75] uppercase">Flight</div>
                    <div className="text-lg font-bold text-[#131b2e]">{passengerData.flightNumber}</div>
                    <div className="text-xs text-[#4a5a75]">{passengerData.destination}</div>
                  </div>
                  <div className="bg-[#f2f3ff] p-3.5 rounded-xl border border-[#dae2fd]/60">
                    <div className="text-[11px] font-bold text-[#4a5a75] uppercase">Cabin Class</div>
                    <div className="text-lg font-bold text-[#131b2e]">Economy</div>
                    <div className="text-xs text-[#006c49] font-semibold">Priority Boarding</div>
                  </div>
                  <div className="bg-[#f2f3ff] p-3.5 rounded-xl border border-[#dae2fd]/60">
                    <div className="text-[11px] font-bold text-[#4a5a75] uppercase">Checked Baggage</div>
                    <div className="text-lg font-bold text-[#131b2e]">2 / 2 Loaded</div>
                    <div className="text-xs text-[#006c49] font-semibold">Holds A-04 Checked</div>
                  </div>
                  <div className="bg-[#f2f3ff] p-3.5 rounded-xl border border-[#dae2fd]/60">
                    <div className="text-[11px] font-bold text-[#4a5a75] uppercase">Gate Pathway</div>
                    <div className="text-lg font-bold text-[#006c49]">Jetbridge Open</div>
                    <div className="text-xs text-[#4a5a75]">Door 2L Direct</div>
                  </div>
                </div>

                {/* Barrier Auto-Close Countdown */}
                <div className="bg-[#e2e7ff]/70 rounded-2xl p-4 flex items-center justify-between gap-4 border border-[#dae2fd]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#006c49] text-white flex items-center justify-center font-bold text-lg animate-pulse">
                      ✓
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#131b2e]">Barrier Status: RETRACTED &amp; UNLOCKED</div>
                      <div className="text-xs text-[#4a5a75]">Turnstile sensors active. Single passenger transit permitted.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shrink-0 shadow-sm border border-[#dae2fd]">
                    <span className="text-xs font-mono font-bold text-[#006194]">
                      Auto-close in {secondsRemaining}s
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full max-w-md flex items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleNextPassenger}
                  className="w-full h-12 rounded-xl bg-white text-[#131b2e] hover:bg-[#eaedff] transition-all font-bold text-sm shadow-sm border border-[#bfc7d2]/50 flex items-center justify-center gap-2"
                >
                  <span>Next Passenger in Queue →</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE 3: BOARDING REFUSED (ACCESS DENIED / WRONG GATE) */}
          {/* ========================================================================= */}
          {currentState === 3 && (
            <div className="w-full max-w-3xl flex flex-col items-center justify-between py-2 transition-all duration-300">
              <div className="w-full text-center space-y-1 mb-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#ffdad6] text-[#ba1a1a] text-sm font-bold shadow-sm border border-[#ba1a1a]/20">
                  <span>✕ {t.s3Badge}</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-[#131b2e] tracking-tight">{t.s3Title}</h1>
                <p className="text-base text-[#4a5a75]">{t.s3Sub}</p>
              </div>

              <div className="w-full bg-white rounded-3xl p-6 shadow-xl flex flex-col gap-5 relative overflow-hidden border border-[#dae2fd]">
                <div className="absolute top-0 left-0 right-0 h-2 bg-[#ba1a1a]"></div>

                <div className="flex items-center gap-4 bg-[#ffdad6]/40 p-4 rounded-2xl border border-[#ba1a1a]/20">
                  <div className="w-12 h-12 rounded-2xl bg-[#ba1a1a] text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-sm">
                    ✕
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#93000a]">e-Gate Barrier Locked</div>
                    <div className="text-xs text-[#4a5a75]">Turnstile remains sealed. Station operations logged event #DENY-8842.</div>
                  </div>
                </div>

                <div className="bg-[#f2f3ff] p-4 rounded-2xl space-y-3 border border-[#dae2fd]">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#4a5a75]">Biometric Manifest Comparison</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-3.5 rounded-xl border border-[#dae2fd]">
                      <div className="text-xs text-[#707881] font-semibold">Identified Traveler</div>
                      <div className="text-lg font-bold text-[#131b2e]">MR. ALEX SMITH</div>
                      <div className="text-xs text-[#ba1a1a] font-semibold mt-1">
                        ✕ Not on QR-082 Manifest
                      </div>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl border-2 border-[#006194]/30">
                      <div className="text-xs text-[#006194] font-bold uppercase">Correct Flight Found in Airport DB</div>
                      <div className="text-lg font-bold text-[#131b2e]">EK-204 • Dubai (DXB)</div>
                      <div className="text-xs font-bold text-[#006c49] mt-1">
                        📍 Assigned to Concourse C • Gate C14
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-[#e2e7ff]/50 p-4 rounded-2xl border border-[#dae2fd]">
                  <div className="text-xs text-[#4a5a75] space-y-1">
                    <div className="font-bold text-[#131b2e] text-sm">Wayfinding Route Guidance:</div>
                    <div>Gate C14 is an estimated <strong className="text-[#131b2e]">7-minute walk</strong>. Head south toward Concourse C transit hub, take the express moving walkway to Level 2.</div>
                  </div>
                </div>
              </div>

              <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4">
                <button
                  type="button"
                  onClick={handleNextPassenger}
                  className="h-12 rounded-xl bg-white text-[#131b2e] hover:bg-[#eaedff] transition-all font-bold text-xs flex items-center justify-center border border-[#bfc7d2]"
                >
                  Retry Face Scan
                </button>
                <button
                  type="button"
                  onClick={() => handleStateTransition(4)}
                  className="h-12 rounded-xl bg-white text-[#131b2e] hover:bg-[#eaedff] transition-all font-bold text-xs flex items-center justify-center border border-[#bfc7d2]"
                >
                  Scan Paper Pass
                </button>
                <button
                  type="button"
                  onClick={() => setIsAssistModalOpen(true)}
                  className="h-12 rounded-xl bg-[#006194] text-white hover:bg-[#007bb9] transition-all font-bold text-xs flex items-center justify-center shadow-sm"
                >
                  Gate Agent Help
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STATE 4: MANUAL BOARDING PASS SCAN FALLBACK */}
          {/* ========================================================================= */}
          {currentState === 4 && (
            <div className="w-full max-w-3xl flex flex-col items-center justify-between py-2 transition-all duration-300">
              <div className="w-full text-center space-y-1 mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#dae2fd] text-[#006194] text-xs font-bold tracking-wide">
                  <span>OPTICAL BARCODE FALLBACK</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-[#131b2e] tracking-tight">{t.s4Title}</h1>
                <p className="text-base text-[#4a5a75]">{t.s4Sub}</p>
              </div>

              <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl flex flex-col items-center justify-center gap-5 relative overflow-hidden border border-[#dae2fd]">
                <div className="w-64 h-52 rounded-2xl bg-[#f2f3ff] relative flex flex-col items-center justify-center overflow-hidden border border-[#bfc7d2]">
                  <div className="absolute left-4 right-4 h-0.5 bg-[#ba1a1a] shadow-[0_0_12px_#ba1a1a] animate-pulse"></div>
                  <div className="z-10 flex flex-col items-center gap-2 pointer-events-none">
                    <span className="text-3xl">📷</span>
                    <span className="text-xs font-bold text-[#4a5a75] bg-[#eaedff] px-3 py-1 rounded-full border border-[#dae2fd]">
                      Position 5 - 10 cm Above Glass
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs text-[#4a5a75]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#006c49]"></span>
                  <span>Optical Barcode Imager Ready • PDF417 / Aztec / QR</span>
                </div>
              </div>

              <div className="w-full max-w-md flex flex-col gap-2.5 mt-4">
                <div className="text-center text-xs text-[#707881] uppercase tracking-wider font-semibold">Simulate Barcode Ingestion:</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await SmartGateApi.verifyAndBoard({ barcode: 'QR82-VALID-PASS', flightNumber: 'QR-082' })
                      if (res.cleared) {
                        setPassengerData(prev => ({
                          ...prev,
                          name: res.passengerName || 'JOHNATHAN DOE',
                          flightNumber: res.flightNumber || 'QR-082',
                          seat: res.seatNumber || '24A',
                          zone: res.group || 'ZONE 2'
                        }))
                        handleToolbarState(2)
                      }
                    }}
                    className="h-12 rounded-xl bg-[#006c49] text-white hover:bg-[#00714d] transition-all font-bold text-xs flex items-center justify-center shadow-sm"
                  >
                    Scan Valid Ticket
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await SmartGateApi.verifyAndBoard({ barcode: 'EK204-WRONG-PASS', flightNumber: 'QR-082' })
                      handleToolbarState(3)
                    }}
                    className="h-12 rounded-xl bg-white text-[#ba1a1a] hover:bg-[#ffdad6] transition-all font-bold text-xs flex items-center justify-center shadow-sm border border-[#ba1a1a]/30"
                  >
                    Scan Wrong Flight Pass
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleNextPassenger}
                  className="text-xs font-semibold text-[#006194] hover:underline text-center py-1 mt-1"
                >
                  ← Return to Facial Biometric Scan
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Assistance Modal */}
      {isAssistModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#131b2e]/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-4 border border-[#dae2fd]">
            <div className="w-16 h-16 rounded-full bg-[#cce5ff] flex items-center justify-center text-[#006194] text-2xl animate-bounce">
              📞
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#131b2e]">Gate Agent Notified</h2>
              <p className="text-sm text-[#4a5a75] mt-1">
                Station Supervisor for Gate B22 has been summoned to turnstile column #02. Please remain at the gate.
              </p>
            </div>
            <div className="w-full bg-[#f2f3ff] p-3 rounded-xl text-xs font-mono text-[#4a5a75]">
              DISPATCH TICKET: #GT-B22-PASS-8819
            </div>
            <button
              type="button"
              onClick={() => setIsAssistModalOpen(false)}
              className="w-full h-11 rounded-xl bg-[#131b2e] text-white font-bold text-sm"
            >
              Dismiss Notice
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full bg-white border-t border-[#dae2fd] py-3 px-6 lg:px-10">
        <div className="w-full flex items-center justify-between text-xs text-[#4a5a75]">
          <span>AeroGate Automated Terminal OS v4.2 • SafeZone Clearance Protocol Active</span>
          <span className="hidden sm:inline">Terminal Biometrics Secured • Operational 24/7</span>
        </div>
      </footer>
    </div>
  )
}
