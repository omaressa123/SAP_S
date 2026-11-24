import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Cctv, ShieldCheck, Play, Pause, RefreshCw, Upload, Video,
  Camera, AlertTriangle, Eye, ShieldAlert, CheckCircle, Activity,
  Radio, Sparkles, Flame, UserX, Clock, Cpu, Scan, Zap,
  LayoutGrid, Maximize2, Bell, BellRing, Volume2, VolumeX,
  ChevronRight, Layers, CheckCircle2, Shield
} from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import { api } from '../services/api'
import { AiModuleLayout, StatusBadge, KvGrid, ResultCard } from '../components/ai/AiVisuals'

// Web Audio API chime helper for autonomous security alerts
function playAlertChime(severity) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(severity === 'Critical' ? 880 : 660, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(severity === 'Critical' ? 440 : 550, ctx.currentTime + 0.22)
    gain.gain.setValueAtTime(0.12, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.22)
    osc.start()
    osc.stop(ctx.currentTime + 0.23)
  } catch {
    // AudioContext blocked by browser policy before user interaction
  }
}

export default function Monitoring() {
  // --- Data State ---
  const [cameras, setCameras] = useState([])
  const [scenarios, setScenarios] = useState([])
  const [recentAlerts, setRecentAlerts] = useState([])
  const [selectedCamId, setSelectedCamId] = useState(1)
  const [selectedScenarioId, setSelectedScenarioId] = useState('unattended_bag')
  const [feedMode, setFeedMode] = useState('preset') // 'preset' | 'upload' | 'webcam'
  const [videoSrc, setVideoSrc] = useState(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [showBoxes, setShowBoxes] = useState(true)
  const [thermalFilter, setThermalFilter] = useState(false)
  const [clockTime, setClockTime] = useState('')
  const [autoScan, setAutoScan] = useState(true) // Auto-detect video stream
  const [isNativeVision, setIsNativeVision] = useState(false)
  const [visionStats, setVisionStats] = useState({ peopleCount: 0, bagCount: 0, unattendedBagCount: 0, lastScanned: null })

  // --- View Mode & Matrix State ---
  const [viewMode, setViewMode] = useState('single') // 'single' | 'matrix'
  const [matrixGridSize, setMatrixGridSize] = useState(4) // 4 (2x2) | 6 (3x2)

  // --- Automated Alert Engine State ---
  const [autoAlertEnabled, setAutoAlertEnabled] = useState(true)
  const [autoEscalateEnabled, setAutoEscalateEnabled] = useState(true)
  const [soundAlertEnabled, setSoundAlertEnabled] = useState(false)
  const [autoAlertToast, setAutoAlertToast] = useState(null)
  const lastAlertSentRef = useRef({})

  // --- Anomaly Form & Detection State ---
  const [form, setForm] = useState({
    cameraId: 1,
    zoneId: 1,
    behaviorType: 'Unattended baggage',
    severity: 'High',
    unattendedDurationSeconds: 28,
    confidence: 95.8,
    details: 'Dark hard-shell suitcase stationary for >20s without passenger in proximity',
    recommendedAction: 'Dispatch EOD / K9 security sweep'
  })
  const [detections, setDetections] = useState([])
  const [result, setResult] = useState(null)
  const [escalateResult, setEscalateResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)

  // --- Refs ---
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const webcamStreamRef = useRef(null)
  const isScanningRef = useRef(false)

  // Live clock ticker
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setClockTime(now.toLocaleTimeString() + ' EET')
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Load cameras and recent alerts on mount
  useEffect(() => {
    loadCameras()
    loadRecentAlerts()
  }, [])

  const loadCameras = async () => {
    try {
      const res = await api('/api/v1/monitoring/cameras')
      if (res?.cameras?.length) {
        setCameras(res.cameras)
        setSelectedCamId(res.cameras[0].cameraId)
      }
      if (res?.scenarios?.length) {
        setScenarios(res.scenarios)
        applyScenario(res.scenarios[0], res.cameras?.[0]?.cameraId || 1, res.cameras?.[0]?.zoneId || 1)
      }
    } catch (err) {
      console.warn('Failed to load cameras, using defaults:', err)
    }
  }

  const loadRecentAlerts = async () => {
    try {
      const res = await api('/api/v1/monitoring/alerts/recent?limit=8')
      if (Array.isArray(res)) {
        setRecentAlerts(res)
      }
    } catch (err) {
      console.warn('Failed to load recent alerts:', err)
    }
  }

  // Selected camera object
  const activeCamera = useMemo(() => {
    return cameras.find((c) => c.cameraId === Number(selectedCamId)) || {
      cameraId: selectedCamId,
      location: `T2-CAM-${String(selectedCamId).padStart(2, '0')}`,
      zoneId: 1,
      zoneName: 'Check-in Hall West',
      status: 'online',
      resolution: '1080p FHD',
      fps: 30
    }
  }, [cameras, selectedCamId])

  // Apply scenario preset (Used in simulation mode)
  const applyScenario = (sc, camId = selectedCamId, zoneId = activeCamera?.zoneId || 1) => {
    setSelectedScenarioId(sc.id)
    setIsNativeVision(false)
    setForm({
      cameraId: camId,
      zoneId: zoneId,
      behaviorType: sc.behaviorType,
      severity: sc.severity,
      unattendedDurationSeconds: sc.durationSeconds,
      confidence: sc.confidence,
      details: sc.description,
      recommendedAction: sc.recommendedAction
    })
    const boxes = [
      {
        label: `${sc.behaviorType} (${sc.confidence}%)`,
        bbox: sc.bbox,
        severity: sc.severity,
        color: sc.severity === 'Critical' ? '#ef4444' : sc.severity === 'High' ? '#f59e0b' : '#3b82f6',
        isAnomaly: sc.severity !== 'Low'
      }
    ]
    if (sc.id !== 'overcrowding') {
      boxes.push({
        label: 'Traveler (Normal)',
        bbox: { x: 74, y: 28, w: 18, h: 48 },
        severity: 'Low',
        color: '#10b981',
        isAnomaly: false
      })
    }
    setDetections(boxes)

    // Autonomous Alert Dispatch in Preset Mode (If High or Critical threat)
    if (autoAlertEnabled && sc.severity !== 'Low') {
      const key = `${camId}-${sc.behaviorType}`
      const now = Date.now()
      if (now - (lastAlertSentRef.current[key] || 0) > 30000) {
        lastAlertSentRef.current[key] = now
        setTimeout(() => {
          triggerAutoAlert({
            detectedBehavior: sc.behaviorType,
            severity: sc.severity,
            confidence: sc.confidence,
            unattendedDurationSeconds: sc.durationSeconds,
            details: sc.description,
            detections: boxes
          }, activeCamera)
        }, 700)
      }
    }
  }

  // Switch camera handler
  const handleCameraChange = (camId) => {
    setSelectedCamId(camId)
    const cam = cameras.find((c) => c.cameraId === Number(camId))
    if (cam) {
      setForm((prev) => ({
        ...prev,
        cameraId: cam.cameraId,
        zoneId: cam.zoneId
      }))
    }
  }

  // Switch scenario handler
  const handleScenarioChange = (scId) => {
    const sc = scenarios.find((s) => s.id === scId)
    if (sc) {
      applyScenario(sc, activeCamera.cameraId, activeCamera.zoneId)
    }
  }

  // Video Upload
  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      stopWebcam()
      const url = URL.createObjectURL(file)
      setVideoSrc(url)
      setFeedMode('upload')
      setIsPlaying(true)
      setDetections([]) // Immediately wipe hardcoded/preset simulation boxes
      setIsNativeVision(true)
      setForm((prev) => ({
        ...prev,
        behaviorType: 'Analyzing video stream…',
        severity: 'Low',
        unattendedDurationSeconds: 0,
        confidence: 0,
        details: `Loaded custom video clip (${file.name}). Scanning frames with YOLOv8…`,
        recommendedAction: 'Live video anomaly detection in progress.'
      }))
      // When video metadata loads, onLoadedData will trigger captureAndScanFrame()
    }
  }

  // Live Webcam Toggle
  const toggleWebcam = async () => {
    if (feedMode === 'webcam') {
      stopWebcam()
      setFeedMode('preset')
      setIsNativeVision(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } })
      webcamStreamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setFeedMode('webcam')
      setIsPlaying(true)
      setDetections([])
      setIsNativeVision(true)
      setForm((prev) => ({
        ...prev,
        behaviorType: 'Live Webcam Active',
        severity: 'Low',
        unattendedDurationSeconds: 0,
        confidence: 0,
        details: 'Live camera stream connected. YOLOv8 scanning real-time frames…',
        recommendedAction: 'Surveillance stream active.'
      }))
      setTimeout(captureAndScanFrame, 400)
    } catch (err) {
      alert('Unable to access webcam: ' + err.message)
    }
  }

  const stopWebcam = () => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach((t) => t.stop())
      webcamStreamRef.current = null
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null
    }
  }

  useEffect(() => {
    return () => stopWebcam()
  }, [])

  // =========================================================================
  // AUTONOMOUS ALERT ENGINE (Dispatches alerts automatically to DB & Multi-Agent Grid)
  // =========================================================================
  const triggerAutoAlert = useCallback(async (analysis, cam = activeCamera) => {
    try {
      const anomalyBox = analysis.detections?.find((d) => d.isAnomaly)?.bbox || { x: 36, y: 42, w: 26, h: 36 }
      const out = await api('/api/v1/monitoring/cctv/detect', {
        method: 'POST',
        body: JSON.stringify({
          cameraId: Number(cam.cameraId || form.cameraId),
          zoneId: Number(cam.zoneId || form.zoneId),
          behaviorType: analysis.detectedBehavior,
          severity: analysis.severity,
          unattendedDurationSeconds: Number(analysis.unattendedDurationSeconds || 0),
          confidence: Number(analysis.confidence || 95),
          detectedBoundingBox: anomalyBox,
          details: analysis.details
        })
      })

      if (out) {
        setResult(out)
        loadRecentAlerts()
        if (soundAlertEnabled) playAlertChime(analysis.severity)

        setAutoAlertToast({
          id: out.monitoringAlertId || Math.floor(Math.random() * 9000 + 1000),
          behavior: analysis.detectedBehavior,
          severity: analysis.severity,
          camera: cam.location,
          zone: cam.zoneName,
          time: new Date().toLocaleTimeString()
        })

        // Auto-escalate Critical emergencies (e.g. Passenger Collapse / Perimeter Breach)
        if (analysis.severity === 'Critical' && autoEscalateEnabled && out?.monitoringAlertId) {
          const esc = await api('/api/v1/monitoring/emergency/escalate', {
            method: 'POST',
            body: JSON.stringify({
              monitoringAlertId: out.monitoringAlertId,
              eventType: analysis.detectedBehavior,
              zoneId: Number(cam.zoneId),
              dispatchUnit: 'security_patrol_robot'
            })
          })
          setEscalateResult(esc)
          loadRecentAlerts()
        }
      }
    } catch (err) {
      console.warn('Autonomous alert dispatch note:', err)
    }
  }, [activeCamera, autoEscalateEnabled, form.cameraId, form.zoneId, soundAlertEnabled])

  // =========================================================================
  // CORE: CAPTURE VIDEO FRAME & RUN NATIVE YOLO INFERENCE
  // =========================================================================
  const captureAndScanFrame = useCallback(async () => {
    if (isScanningRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current

    if (feedMode === 'preset') {
      // In simulation mode, use the preset endpoint
      setScanning(true)
      try {
        const res = await api('/api/v1/monitoring/cctv/analyze-frame', {
          method: 'POST',
          body: JSON.stringify({
            cameraId: Number(form.cameraId),
            zoneId: Number(form.zoneId),
            scenario: selectedScenarioId
          })
        })
        if (res?.detections) setDetections(res.detections)
      } finally {
        setScanning(false)
      }
      return
    }

    // Video / Webcam mode: extract real frame from playing video
    if (!video || !canvas || video.videoWidth <= 0 || video.videoHeight <= 0) {
      return
    }

    isScanningRef.current = true
    setScanning(true)

    try {
      // Optimal scale for fast inference (max 640px wide)
      const maxW = 640
      const scale = Math.min(1.0, maxW / video.videoWidth)
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)

      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const frameBase64 = canvas.toDataURL('image/jpeg', 0.8)

      const res = await api('/api/v1/monitoring/cctv/analyze-frame', {
        method: 'POST',
        body: JSON.stringify({
          cameraId: Number(form.cameraId),
          zoneId: Number(form.zoneId),
          frameBase64: frameBase64
        })
      })

      if (res) {
        if (Array.isArray(res.detections)) {
          setDetections(res.detections)
        }
        if (res.detectedBehavior) {
          setForm((prev) => ({
            ...prev,
            behaviorType: res.detectedBehavior,
            severity: res.severity || prev.severity,
            confidence: res.confidence || prev.confidence,
            unattendedDurationSeconds: res.unattendedDurationSeconds ?? prev.unattendedDurationSeconds,
            details: res.details || prev.details,
            recommendedAction: res.recommendedAction || prev.recommendedAction
          }))
        }
        if (res.isNativeVision) {
          setIsNativeVision(true)
          setVisionStats({
            peopleCount: res.peopleCount ?? 0,
            bagCount: res.bagCount ?? 0,
            unattendedBagCount: res.unattendedBagCount ?? 0,
            lastScanned: new Date().toLocaleTimeString()
          })
        }

        // --- AUTOMATED ALERT DISPATCH ENGINE ---
        const isThreat = res.severity === 'High' || res.severity === 'Critical'
        const hasAnomaly = res.detections?.some((d) => d.isAnomaly) || isThreat
        if (autoAlertEnabled && hasAnomaly && res.detectedBehavior !== 'Normal transit') {
          const key = `${form.cameraId}-${res.detectedBehavior}`
          const now = Date.now()
          // 30s cooldown per camera/behavior to avoid flooding PostgreSQL
          if (now - (lastAlertSentRef.current[key] || 0) > 30000) {
            lastAlertSentRef.current[key] = now
            triggerAutoAlert(res, activeCamera)
          }
        }
      }
    } catch (err) {
      console.warn('YOLO video frame scan note:', err)
    } finally {
      setScanning(false)
      isScanningRef.current = false
    }
  }, [activeCamera, autoAlertEnabled, feedMode, form.cameraId, form.zoneId, selectedScenarioId, triggerAutoAlert])

  // Continuous Auto-Scan Stream: runs every 1.6s while video is playing
  useEffect(() => {
    if (!autoScan || feedMode === 'preset') return
    const timer = setInterval(() => {
      const v = videoRef.current
      if (v && v.readyState >= 2 && !v.paused) {
        captureAndScanFrame()
      }
    }, 1600)
    return () => clearInterval(timer)
  }, [autoScan, feedMode, captureAndScanFrame])

  // Submit Anomaly Report (Save to Database & Broadcast to AOCC)
  const submitAnomaly = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setEscalateResult(null)
    try {
      const out = await api('/api/v1/monitoring/cctv/detect', {
        method: 'POST',
        body: JSON.stringify({
          cameraId: Number(form.cameraId),
          zoneId: Number(form.zoneId),
          behaviorType: form.behaviorType,
          severity: form.severity,
          unattendedDurationSeconds: Number(form.unattendedDurationSeconds || 0),
          confidence: Number(form.confidence || 95),
          detectedBoundingBox: detections.length ? detections[0].bbox : { x: 36, y: 42, w: 26, h: 36 },
          details: form.details
        })
      })
      setResult(out)
      loadRecentAlerts()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  // Escalate Alert (Dispatch Security Robot & Response Team)
  const handleEscalate = async () => {
    if (!result?.monitoringAlertId) return
    setBusy(true)
    try {
      const out = await api('/api/v1/monitoring/emergency/escalate', {
        method: 'POST',
        body: JSON.stringify({
          monitoringAlertId: result.monitoringAlertId,
          eventType: form.behaviorType,
          zoneId: Number(form.zoneId),
          dispatchUnit: 'security_patrol_robot'
        })
      })
      setEscalateResult(out)
      loadRecentAlerts()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const sevTone = /critical/i.test(form.severity) ? 'bad' : /high|medium|warning/i.test(form.severity) ? 'warn' : 'good'

  return (
    <div className="security-page">
      <AiModuleLayout
        icon={<Cctv size={24} />}
        title="CCTV Surveillance — Real-Time Video Anomaly Detection"
        description="Autonomous YOLOv8 vision engine detects travelers, luggage, unattended baggage, and anomalies directly from CCTV video frames."
        aiStatus="online"
        systemNote="YOLOv8 Native Vision • Real-Time Object Detection Active"
        stats={[
          { label: 'Camera', value: activeCamera.location.split(' ')[0] || `CAM-${form.cameraId}`, sub: activeCamera.zoneName },
          { label: 'Severity', value: form.severity?.toUpperCase() || 'NORMAL', sub: form.behaviorType },
          { label: 'Active Alerts', value: recentAlerts.length ? `${recentAlerts.length} logged` : '0', sub: 'PostgreSQL DB' },
          { label: 'Vision Engine', value: isNativeVision ? 'YOLOv8 Native' : 'Scenario Simulation', sub: isNativeVision ? `${visionStats.peopleCount} pax · ${visionStats.bagCount} bags` : 'Presets' }
        ]}
      >
        {/* ========================================== */}
        {/* TOP COMMAND TOOLBAR                        */}
        {/* ========================================== */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 18px',
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          marginBottom: 16
        }}>
          {/* LEFT: View Mode Segmented Switch (Single Focus vs Matrix Grid) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', padding: 3, borderRadius: 8, border: '1px solid #cbd5e1' }}>
              <button
                type="button"
                onClick={() => setViewMode('single')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: viewMode === 'single' ? '#007bb9' : 'transparent',
                  color: viewMode === 'single' ? '#ffffff' : '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Maximize2 size={13} /> Single Camera Focus
              </button>
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: viewMode === 'matrix' ? '#007bb9' : 'transparent',
                  color: viewMode === 'matrix' ? '#ffffff' : '#475569',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <LayoutGrid size={13} /> Multi-Camera Matrix (Grid)
              </button>
            </div>

            {/* In Single Mode: Camera Selector */}
            {viewMode === 'single' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#071739', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Camera size={15} color="#007bb9" /> Cam:
                </label>
                <select
                  value={selectedCamId}
                  onChange={(e) => handleCameraChange(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 7,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#071739',
                    background: '#f8fafc',
                    cursor: 'pointer'
                  }}
                >
                  {cameras.map((c) => (
                    <option key={c.cameraId} value={c.cameraId}>
                      {c.location} — {c.zoneName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* In Matrix Mode: Matrix Grid Sizer */}
            {viewMode === 'matrix' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '3px 8px', borderRadius: 7, border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>Matrix Grid:</span>
                <button
                  type="button"
                  onClick={() => setMatrixGridSize(4)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 5,
                    border: 'none',
                    background: matrixGridSize === 4 ? '#007bb9' : 'transparent',
                    color: matrixGridSize === 4 ? '#ffffff' : '#475569',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  2×2 (4 Cams)
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixGridSize(6)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 5,
                    border: 'none',
                    background: matrixGridSize === 6 ? '#007bb9' : 'transparent',
                    color: matrixGridSize === 6 ? '#ffffff' : '#475569',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  3×2 (6 Cams)
                </button>
              </div>
            )}

            {/* Scenario Selector (When in single & preset mode) */}
            {viewMode === 'single' && feedMode === 'preset' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#071739', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Sparkles size={15} color="#f59e0b" /> Scenario:
                </label>
                <select
                  value={selectedScenarioId}
                  onChange={(e) => handleScenarioChange(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 7,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: '#071739',
                    background: '#f8fafc',
                    cursor: 'pointer'
                  }}
                >
                  {scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} [{s.severity}]
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* RIGHT: Feed Mode Switches & Automated Alert Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {viewMode === 'single' && (
              <>
                <Button
                  type="button"
                  onClick={() => { stopWebcam(); setFeedMode('preset'); setIsNativeVision(false); }}
                  style={{
                    padding: '6px 11px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: feedMode === 'preset' ? '#071739' : '#f1f5f9',
                    color: feedMode === 'preset' ? '#ffffff' : '#334155',
                    borderRadius: 7,
                    border: 'none'
                  }}
                >
                  Preset Demo
                </Button>

                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: '6px 11px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: feedMode === 'upload' ? '#007bb9' : '#f1f5f9',
                    color: feedMode === 'upload' ? '#ffffff' : '#334155',
                    borderRadius: 7,
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <Upload size={13} /> Upload Video
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="video/*"
                  style={{ display: 'none' }}
                  onChange={handleVideoUpload}
                />

                <Button
                  type="button"
                  onClick={toggleWebcam}
                  style={{
                    padding: '6px 11px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    background: feedMode === 'webcam' ? '#ef4444' : '#f1f5f9',
                    color: feedMode === 'webcam' ? '#ffffff' : '#334155',
                    borderRadius: 7,
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <Radio size={13} /> {feedMode === 'webcam' ? 'Stop Cam' : 'Webcam'}
                </Button>
              </>
            )}

            {/* AUTOMATED ALERT CONTROLS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderLeft: '1px solid #e2e8f0', paddingLeft: 8 }}>
              <button
                type="button"
                onClick={() => setAutoAlertEnabled(!autoAlertEnabled)}
                title="When ON: Automatically writes anomalies to PostgreSQL and broadcasts to AOCC Multi-Agent Grid"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 11px',
                  borderRadius: 7,
                  border: autoAlertEnabled ? '1px solid #86efac' : '1px solid #cbd5e1',
                  background: autoAlertEnabled ? '#f0fdf4' : '#f8fafc',
                  color: autoAlertEnabled ? '#15803d' : '#64748b',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Zap size={13} color={autoAlertEnabled ? '#16a34a' : '#94a3b8'} />
                <span>Auto-Alert: {autoAlertEnabled ? 'ACTIVE' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => setAutoEscalateEnabled(!autoEscalateEnabled)}
                title="When ON: Automatically dispatches patrol robot AeroGuard-07 for Critical medical/perimeter incidents"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 11px',
                  borderRadius: 7,
                  border: autoEscalateEnabled ? '1px solid #fca5a5' : '1px solid #cbd5e1',
                  background: autoEscalateEnabled ? '#fef2f2' : '#f8fafc',
                  color: autoEscalateEnabled ? '#b91c1c' : '#64748b',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <ShieldAlert size={13} color={autoEscalateEnabled ? '#ef4444' : '#94a3b8'} />
                <span>Auto-Robot: {autoEscalateEnabled ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSoundAlertEnabled(!soundAlertEnabled)}
                title="Toggle Web Audio alarm chimes on automatic alert dispatch"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 30,
                  height: 30,
                  borderRadius: 7,
                  border: '1px solid #cbd5e1',
                  background: soundAlertEnabled ? '#eff6ff' : '#f8fafc',
                  color: soundAlertEnabled ? '#0284c7' : '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                {soundAlertEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* AUTONOMOUS SECURITY ALERT DISPATCH BANNER  */}
        {/* ========================================== */}
        {autoAlertToast && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '12px 18px',
            borderRadius: 10,
            background: autoAlertToast.severity === 'Critical' ? '#fef2f2' : '#fffbeb',
            border: `1px solid ${autoAlertToast.severity === 'Critical' ? '#fca5a5' : '#fcd34d'}`,
            marginBottom: 16,
            boxShadow: '0 4px 14px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: autoAlertToast.severity === 'Critical' ? '#fee2e2' : '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <BellRing size={18} color={autoAlertToast.severity === 'Critical' ? '#dc2626' : '#d97706'} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: autoAlertToast.severity === 'Critical' ? '#991b1b' : '#92400e' }}>
                    🚨 AUTONOMOUS SECURITY ALERT #{autoAlertToast.id} DISPATCHED
                  </span>
                  <span style={{ fontSize: '0.72rem', padding: '1px 7px', borderRadius: 10, background: autoAlertToast.severity === 'Critical' ? '#dc2626' : '#d97706', color: '#fff', fontWeight: 700 }}>
                    {autoAlertToast.severity?.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>at {autoAlertToast.time}</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: 2 }}>
                  Computer Vision detected <strong>{autoAlertToast.behavior}</strong> at <strong>{autoAlertToast.camera} — {autoAlertToast.zone}</strong>. Incident auto-logged to PostgreSQL and broadcasted to Airport Multi-Agent Grid (AOCC).
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {viewMode === 'matrix' && (
                <button
                  type="button"
                  onClick={() => setViewMode('single')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#071739',
                    cursor: 'pointer'
                  }}
                >
                  Inspect in Focus ↗
                </button>
              )}
              <button
                type="button"
                onClick={() => setAutoAlertToast(null)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: '#94a3b8',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* ========================================== */}
        {/* SURVEILLANCE STAGE: MATRIX OR SINGLE FOCUS */}
        {/* ========================================== */}
        {viewMode === 'matrix' ? (
          <div>
            {/* Matrix Wall Controls Header */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '12px 18px',
              background: '#040d1a',
              borderRadius: 12,
              color: '#ffffff',
              marginBottom: 16,
              border: '1px solid #1e293b'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <LayoutGrid size={18} color="#38bdf8" />
                <span style={{ fontSize: '0.9rem', fontWeight: 800, letterSpacing: '0.02em' }}>
                  CCTV SURVEILLANCE MATRIX WALL — {matrixGridSize} ACTIVE CHANNELS
                </span>
                <span style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                  AOCC MULTI-STREAM
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Grid Layout:</span>
                <div style={{ display: 'flex', alignItems: 'center', background: '#0f172a', borderRadius: 6, padding: 2, border: '1px solid #334155' }}>
                  <button
                    type="button"
                    onClick={() => setMatrixGridSize(4)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      border: 'none',
                      background: matrixGridSize === 4 ? '#0284c7' : 'transparent',
                      color: matrixGridSize === 4 ? '#ffffff' : '#94a3b8',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    2×2 (4 Cams)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatrixGridSize(6)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 4,
                      border: 'none',
                      background: matrixGridSize === 6 ? '#0284c7' : 'transparent',
                      color: matrixGridSize === 6 ? '#ffffff' : '#94a3b8',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    3×2 (6 Cams)
                  </button>
                </div>
              </div>
            </div>

            {/* Matrix Tile Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: matrixGridSize === 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
              gap: 16,
              marginBottom: 20
            }}>
              {cameras.slice(0, matrixGridSize).map((cam, idx) => {
                const isSelected = cam.cameraId === Number(selectedCamId)
                const hasAnomaly = isSelected && (form.severity === 'High' || form.severity === 'Critical')
                return (
                  <div
                    key={cam.cameraId}
                    onClick={() => {
                      setSelectedCamId(cam.cameraId)
                      handleCameraChange(cam.cameraId)
                    }}
                    style={{
                      position: 'relative',
                      background: '#040d1a',
                      borderRadius: 10,
                      overflow: 'hidden',
                      border: isSelected ? '2px solid #007bb9' : hasAnomaly ? '2px solid #ef4444' : '1px solid #1e293b',
                      boxShadow: isSelected ? '0 0 16px rgba(0, 123, 185, 0.4)' : hasAnomaly ? '0 0 16px rgba(239, 68, 68, 0.4)' : 'none',
                      height: 260,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out'
                    }}
                  >
                    {/* Top HUD in Tile */}
                    <div style={{
                      position: 'absolute',
                      top: 8,
                      left: 10,
                      right: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      zIndex: 10,
                      pointerEvents: 'none'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} />
                        <span style={{ color: '#ffffff', fontSize: '0.68rem', fontWeight: 800, fontFamily: 'monospace' }}>
                          REC · {cam.location}
                        </span>
                      </div>
                      <span style={{ color: '#38bdf8', fontSize: '0.68rem', fontWeight: 700, fontFamily: 'monospace', background: 'rgba(0,0,0,0.6)', padding: '1px 6px', borderRadius: 3 }}>
                        {cam.zoneName}
                      </span>
                    </div>

                    {/* Camera Feed Stage */}
                    {isSelected && (feedMode === 'upload' || feedMode === 'webcam') ? (
                      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <video
                          src={feedMode === 'upload' ? videoSrc : undefined}
                          autoPlay
                          loop
                          playsInline
                          muted
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {/* Mini BBox indicators */}
                        {showBoxes && detections.slice(0, 4).map((det, dIdx) => (
                          <div
                            key={dIdx}
                            style={{
                              position: 'absolute',
                              left: `${det.bbox.x}%`,
                              top: `${det.bbox.y}%`,
                              width: `${det.bbox.w}%`,
                              height: `${det.bbox.h}%`,
                              border: `2px solid ${det.isAnomaly ? '#ef4444' : det.color || '#10b981'}`,
                              background: det.isAnomaly ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                              pointerEvents: 'none'
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      /* Synthetic Terminal Perspective Scene for Matrix Channel */
                      <div style={{ position: 'relative', width: '100%', height: '100%', background: 'radial-gradient(circle at 50% 40%, rgba(15, 35, 60, 0.7) 0%, rgba(3, 10, 20, 0.98) 100%)', overflow: 'hidden' }}>
                        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.22 }}>
                          <line x1="0" y1="260" x2="160" y2="100" stroke="#38bdf8" strokeWidth="1" />
                          <line x1="100" y1="260" x2="180" y2="100" stroke="#38bdf8" strokeWidth="1" />
                          <line x1="260" y1="260" x2="220" y2="100" stroke="#38bdf8" strokeWidth="1" />
                          <line x1="360" y1="260" x2="240" y2="100" stroke="#38bdf8" strokeWidth="1" />
                          <ellipse cx="200" cy="180" rx="90" ry="25" fill="none" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="3 3" />
                        </svg>

                        {/* Channel Scene Marker */}
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <Camera size={26} color="#334155" />
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                            Channel 0{idx + 1} • {cam.location}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#475569' }}>
                            {cam.zoneName} · 30 FPS
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Bottom Status Bar in Tile */}
                    <div style={{
                      position: 'absolute',
                      bottom: 8,
                      left: 10,
                      right: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      zIndex: 10
                    }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        background: hasAnomaly ? '#ef4444' : isSelected ? '#0284c7' : '#10b981',
                        color: '#ffffff'
                      }}>
                        {hasAnomaly ? `⚠️ ${form.behaviorType?.toUpperCase()}` : isSelected ? 'FOCUS CHANNEL' : '🟢 ZONE SECURE'}
                      </span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedCamId(cam.cameraId)
                          handleCameraChange(cam.cameraId)
                          setViewMode('single')
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: 'rgba(255, 255, 255, 0.18)',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Inspect <Maximize2 size={10} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Matrix Telemetry Summary Strip */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 12,
              padding: '14px 18px',
              borderRadius: 10,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              marginBottom: 16
            }}>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>AOCC MATRIX SENSORS</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#071739' }}>{cameras.length} Active Feeds</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>AUTONOMOUS SENTRY</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: autoAlertEnabled ? '#15803d' : '#64748b' }}>
                  {autoAlertEnabled ? '⚡ Auto-Dispatch ACTIVE' : 'Manual Intake'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>AI ROBOT PATROL</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: autoEscalateEnabled ? '#b91c1c' : '#64748b' }}>
                  {autoEscalateEnabled ? 'AeroGuard-07 Standby' : 'Manual Escalation'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700 }}>TOTAL POSTGRESQL ALERTS</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0284c7' }}>{recentAlerts.length} Logged</div>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================== */
          /* SINGLE CAMERA INSPECTION VIEW (2-COL)      */
          /* ========================================== */
          <div className="security-grid" style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: 20 }}>
            {/* LEFT: LIVE CCTV VIDEO STAGE WITH BBOX OVERLAY */}
            <Card className="ops-glass-card security-camera-card" title="Surveillance Video Feed — YOLOv8 Detection Overlay">
              <div
                className={`cam-stage security-camera-stage ${thermalFilter ? 'thermal-vision' : ''}`}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: 380,
                  background: '#040d1a',
                  borderRadius: 12,
                  overflow: 'hidden',
                  boxShadow: 'inset 0 0 40px rgba(0,0,0,0.8)'
                }}
              >
                {/* Native HTML5 Video Element */}
                {(feedMode === 'upload' || feedMode === 'webcam') && (
                  <video
                    ref={videoRef}
                    src={feedMode === 'upload' ? videoSrc : undefined}
                  autoPlay
                  loop
                  playsInline
                  muted
                  onLoadedData={() => {
                    // Video first frame decoded: run YOLO!
                    setTimeout(captureAndScanFrame, 200)
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              )}

              {/* Ambient Synthetic Scene (When in preset demo mode) */}
              {feedMode === 'preset' && (
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'radial-gradient(circle at 50% 40%, rgba(20, 45, 75, 0.6) 0%, rgba(3, 12, 24, 0.95) 100%)'
                  }} />
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.25 }}>
                    <line x1="0" y1="380" x2="400" y2="180" stroke="#38bdf8" strokeWidth="1" />
                    <line x1="200" y1="380" x2="450" y2="180" stroke="#38bdf8" strokeWidth="1" />
                    <line x1="500" y1="380" x2="520" y2="180" stroke="#38bdf8" strokeWidth="1" />
                    <line x1="800" y1="380" x2="590" y2="180" stroke="#38bdf8" strokeWidth="1" />
                    <line x1="1000" y1="380" x2="650" y2="180" stroke="#38bdf8" strokeWidth="1" />
                  </svg>
                  {selectedScenarioId === 'unattended_bag' && (
                    <div style={{ position: 'absolute', left: '42%', top: '52%', width: 48, height: 58, background: '#1e293b', borderRadius: 6, border: '2px solid #64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 10, fontWeight: 700 }}>
                      BAG
                    </div>
                  )}
                </div>
              )}

              {/* Hidden canvas for video frame extraction */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {/* CCTV Top Information HUD */}
              <div style={{
                position: 'absolute',
                top: 12,
                left: 14,
                right: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 10,
                pointerEvents: 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: '#ffffff',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.05em'
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ffffff', animation: 'pulse 1.2s infinite' }} /> REC
                  </span>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: '#38bdf8',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    {activeCamera.location} · {activeCamera.zoneName}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: '#94a3b8',
                    fontFamily: 'monospace',
                    fontSize: '0.72rem'
                  }}>
                    30 FPS · 1080p
                  </span>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: 'rgba(0, 0, 0, 0.7)',
                    color: '#f8fafc',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {clockTime}
                  </span>
                </div>
              </div>

              {/* REAL-TIME BOUNDING BOX OVERLAYS (Normalized 0-100% directly from YOLO) */}
              {showBoxes && detections.map((det, idx) => {
                const isThreat = det.isAnomaly || det.severity === 'High' || det.severity === 'Critical'
                return (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: `${det.bbox.x}%`,
                      top: `${det.bbox.y}%`,
                      width: `${det.bbox.w}%`,
                      height: `${det.bbox.h}%`,
                      border: `2px solid ${isThreat ? '#ef4444' : det.color || '#10b981'}`,
                      borderRadius: 4,
                      background: isThreat ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.08)',
                      boxShadow: isThreat ? '0 0 16px rgba(239, 68, 68, 0.6)' : 'none',
                      zIndex: 8,
                      pointerEvents: 'none',
                      transition: 'all 0.15s ease-out'
                    }}
                  >
                    {/* Corner Reticles */}
                    <span style={{ position: 'absolute', top: -3, left: -3, width: 8, height: 8, borderTop: `3px solid ${det.color || '#10b981'}`, borderLeft: `3px solid ${det.color || '#10b981'}` }} />
                    <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderTop: `3px solid ${det.color || '#10b981'}`, borderRight: `3px solid ${det.color || '#10b981'}` }} />
                    <span style={{ position: 'absolute', bottom: -3, left: -3, width: 8, height: 8, borderBottom: `3px solid ${det.color || '#10b981'}`, borderLeft: `3px solid ${det.color || '#10b981'}` }} />
                    <span style={{ position: 'absolute', bottom: -3, right: -3, width: 8, height: 8, borderBottom: `3px solid ${det.color || '#10b981'}`, borderRight: `3px solid ${det.color || '#10b981'}` }} />

                    {/* Tag Label */}
                    <div style={{
                      position: 'absolute',
                      top: -24,
                      left: -2,
                      padding: '2px 8px',
                      borderRadius: 3,
                      background: isThreat ? '#ef4444' : det.color || '#10b981',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      {isThreat && <AlertTriangle size={11} />}
                      {det.label}
                    </div>
                  </div>
                )
              })}

              {/* Scanning Laser Animation */}
              {scanning && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  height: 3,
                  background: 'linear-gradient(90deg, transparent, #38bdf8, transparent)',
                  boxShadow: '0 0 16px #38bdf8',
                  animation: 'cctvScan 1.2s ease-in-out infinite',
                  zIndex: 9
                }} />
              )}

              {/* Bottom HUD Bar */}
              <div style={{
                position: 'absolute',
                bottom: 12,
                left: 14,
                right: 14,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 10
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <StatusBadge tone={sevTone}>
                    {form.severity.toUpperCase()} · {form.behaviorType.toUpperCase()}
                  </StatusBadge>
                  {isNativeVision && (
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: '#10b981', color: '#fff', fontSize: '0.68rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Zap size={11} /> YOLOv8 Live Vision
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: 6 }}>
                  <Cpu size={13} color="#38bdf8" />
                  <span style={{ fontSize: '0.68rem', color: '#cbd5e1', fontFamily: 'monospace' }}>
                    {detections.length} objects · Conf: {form.confidence}%
                  </span>
                </div>
              </div>
            </div>

            {/* Stage Controls Toolbar */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '12px 0 0 0',
              borderTop: '1px solid #f1f5f9',
              marginTop: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(feedMode === 'upload' || feedMode === 'webcam') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) {
                        if (isPlaying) videoRef.current.pause()
                        else videoRef.current.play()
                        setIsPlaying(!isPlaying)
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={captureAndScanFrame}
                  disabled={scanning}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Scan size={14} className={scanning ? 'spin' : ''} />
                  <span>{scanning ? 'Analyzing Frame…' : 'Scan Video Frame (YOLO)'}</span>
                </button>

                {(feedMode === 'upload' || feedMode === 'webcam') && (
                  <button
                    type="button"
                    onClick={() => setAutoScan(!autoScan)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: autoScan ? '#ecfdf5' : '#ffffff',
                      color: autoScan ? '#065f46' : '#475569',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    <Zap size={14} color={autoScan ? '#10b981' : '#94a3b8'} />
                    <span>Auto-Detect: {autoScan ? 'ON' : 'OFF'}</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowBoxes(!showBoxes)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: showBoxes ? '#e0f2fe' : '#ffffff',
                    color: showBoxes ? '#0369a1' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Eye size={14} />
                  <span>{showBoxes ? 'Hide BBoxes' : 'Show BBoxes'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setThermalFilter(!thermalFilter)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: thermalFilter ? '#0f172a' : '#ffffff',
                    color: thermalFilter ? '#38bdf8' : '#475569',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <span>{thermalFilter ? 'Thermal: ON' : 'Thermal Mode'}</span>
                </button>
              </div>
            </div>
          </Card>

          {/* RIGHT: INCIDENT & ANOMALY INTAKE PANEL */}
          <Card className="ops-glass-card security-report-card" title="AI Incident & Anomaly Intake">
            {/* Live Real-Time YOLO Metrics Card */}
            {isNativeVision && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 8,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                marginBottom: 12
              }}>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 700 }}>TRAVELERS</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>{visionStats.peopleCount}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 700 }}>LUGGAGE</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d' }}>{visionStats.bagCount}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#166534', fontWeight: 700 }}>UNATTENDED</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: visionStats.unattendedBagCount > 0 ? '#b91c1c' : '#15803d' }}>
                    {visionStats.unattendedBagCount}
                  </div>
                </div>
              </div>
            )}

            <p className="security-form-intro" style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 12 }}>
              {isNativeVision
                ? 'YOLO is detecting objects directly from the video. Review details to broadcast or escalate.'
                : 'Confirm the detected incident details to submit an alert into the airport multi-agent grid.'}
            </p>

            <form className="ops-form security-form" onSubmit={submitAnomaly}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <label className="ops-field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>Camera ID & Code</span>
                  <input
                    type="number"
                    value={form.cameraId}
                    onChange={(e) => setForm({ ...form, cameraId: e.target.value })}
                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </label>

                <label className="ops-field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>Zone ID</span>
                  <input
                    type="number"
                    value={form.zoneId}
                    onChange={(e) => setForm({ ...form, zoneId: e.target.value })}
                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>Detected Anomaly / Behavior</span>
                <input
                  type="text"
                  value={form.behaviorType}
                  onChange={(e) => setForm({ ...form, behaviorType: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <label className="ops-field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>Severity Level</span>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm({ ...form, severity: e.target.value })}
                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem', background: '#fff' }}
                  >
                    <option value="Low">Low (Informational)</option>
                    <option value="Medium">Medium (Attention)</option>
                    <option value="High">High (Security Alert)</option>
                    <option value="Critical">Critical (Immediate Response)</option>
                  </select>
                </label>

                <label className="ops-field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>Duration / Timer (s)</span>
                  <input
                    type="number"
                    value={form.unattendedDurationSeconds}
                    onChange={(e) => setForm({ ...form, unattendedDurationSeconds: e.target.value })}
                    style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </label>
              </div>

              {/* Incident Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>AI Video Analysis Description</span>
                <p style={{ margin: 0, padding: '8px 10px', borderRadius: 6, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#475569' }}>
                  {form.details}
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Button
                  className="ops-gradient-button security-submit"
                  disabled={busy}
                  style={{ width: '100%', justifyContent: 'center', padding: '10px 14px', fontSize: '0.85rem' }}
                >
                  <ShieldCheck size={18} />
                  <span>{busy ? 'Logging Anomaly…' : 'Generate Security Alert & Broadcast'}</span>
                </Button>

                {result && !escalateResult && (
                  <Button
                    type="button"
                    onClick={handleEscalate}
                    disabled={busy}
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      padding: '10px 14px',
                      fontSize: '0.85rem',
                      background: '#b91c1c',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontWeight: 700
                    }}
                  >
                    <ShieldAlert size={18} />
                    <span>Dispatch Patrol Unit & Escalate Alert</span>
                  </Button>
                )}
              </div>
            </form>

            {error && <p className="error ops-error" role="alert" style={{ marginTop: 10 }}>{error}</p>}
          </Card>
        </div>
      )}

        {/* ========================================== */}
        {/* ESCALATION / DISPATCH RESULT BANNER        */}
        {/* ========================================== */}
        {escalateResult && (
          <div style={{ marginTop: 16 }}>
            <ResultCard tone="bad" title={`PATROL DISPATCHED — EMERGENCY EVENT #${escalateResult.eventId}`}>
              <KvGrid items={[
                { k: 'Assigned Patrol Unit', v: `${escalateResult.assignedRobot?.callsign} (${escalateResult.assignedRobot?.type})` },
                { k: 'ETA to Target Zone', v: `${escalateResult.assignedRobot?.etaSeconds} seconds` },
                { k: 'Status', v: escalateResult.status?.toUpperCase() },
                { k: 'Linked Alert ID', v: `#${escalateResult.monitoringAlertId}` },
                { k: 'Dispatched At', v: escalateResult.dispatchedAt }
              ]} />
            </ResultCard>
          </div>
        )}

        {/* ========================================== */}
        {/* CREATED ALERT SUMMARY CARD                 */}
        {/* ========================================== */}
        {result && !escalateResult && (
          <div style={{ marginTop: 16 }}>
            <ResultCard
              tone={result.alertLevel === 'high' || result.alertLevel === 'critical' ? 'bad' : 'warn'}
              title={`ALERT #${result.monitoringAlertId} CREATED — ${result.status?.toUpperCase()}`}
            >
              <KvGrid items={[
                { k: 'Monitoring Alert ID', v: `#${result.monitoringAlertId}` },
                { k: 'Target Camera', v: `CAM-${result.cameraId} (Zone ${result.zoneId})` },
                { k: 'Alert Level', v: result.alertLevel?.toUpperCase() },
                { k: 'Broadcasted to AOCC', v: result.broadcastedToAocc ? 'Yes (Safety Agent Notified)' : 'No' },
                { k: 'Timestamp', v: result.timestamp }
              ]} />
            </ResultCard>
          </div>
        )}

        {/* ========================================== */}
        {/* RECENT CCTV ALERTS & AUDIT TRAIL TABLE     */}
        {/* ========================================== */}
        <div style={{ marginTop: 24 }}>
          <Card title="Live Airport CCTV Incidents Log (PostgreSQL DB)">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Alert #</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Camera & Zone</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Anomaly Behavior</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Severity</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Status</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700, color: '#475569' }}>Logged Time</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAlerts.map((alt) => (
                    <tr
                      key={alt.alertId}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#071739' }}>#{alt.alertId}</td>
                      <td style={{ padding: '10px 12px', color: '#1e293b' }}>
                        <div>{alt.cameraLocation}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{alt.zoneName}</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{alt.behaviorType}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <StatusBadge tone={alt.severity?.toLowerCase() === 'critical' ? 'bad' : alt.severity?.toLowerCase() === 'high' ? 'warn' : 'idle'}>
                          {alt.severity}
                        </StatusBadge>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: alt.status === 'escalated' ? '#fee2e2' : '#ecfdf5',
                          color: alt.status === 'escalated' ? '#991b1b' : '#065f46'
                        }}>
                          {alt.status?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                        {alt.timestamp ? new Date(alt.timestamp).toLocaleTimeString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </AiModuleLayout>
    </div>
  )
}
