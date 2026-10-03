import React, { useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function FaceCapture({ sessionId, onFaceCaptured }) {
  const webcamRef = useRef(null);
  const [useFileUpload, setUseFileUpload] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleCapture = useCallback(async () => {
    if (useFileUpload) return; // handled by file input
    
    setCapturing(true);
    setError(null);
    try {
      // Capture 3 frames for liveness
      const frames = [];
      for (let i = 0; i < 3; i++) {
        const imageSrc = webcamRef.current.getScreenshot();
        if (imageSrc) frames.push(imageSrc);
        if (i < 2) await new Promise(resolve => setTimeout(resolve, 300));
      }

      if (frames.length === 0) {
        throw new Error('Failed to capture from webcam');
      }

      const formData = new FormData();
      formData.append('frame1', await fetch(frames[0]).then(r => r.blob()), 'frame1.jpg');
      if (frames.length > 1) formData.append('frame2', await fetch(frames[1]).then(r => r.blob()), 'frame2.jpg');
      if (frames.length > 2) formData.append('frame3', await fetch(frames[2]).then(r => r.blob()), 'frame3.jpg');
      formData.append('skip_liveness', 'false');

      // The API endpoint runs on backend (e.g. 127.0.0.1:8001)
      const res = await axios.post(`http://127.0.0.1:8001/kiosk/session/${sessionId}/face`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setSuccess(true);
      setTimeout(() => onFaceCaptured(res.data), 1500);

    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      const errMsg = typeof detail === 'string' ? detail : detail?.message || err.message || 'Face capture failed';
      setError(errMsg);
    } finally {
      setCapturing(false);
    }
  }, [webcamRef, sessionId, onFaceCaptured, useFileUpload]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCapturing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('frame1', file);
      formData.append('skip_liveness', 'true'); // single file, skip motion liveness

      const res = await axios.post(`http://127.0.0.1:8001/kiosk/session/${sessionId}/face`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess(true);
      setTimeout(() => onFaceCaptured(res.data), 1500);
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail;
      const errMsg = typeof detail === 'string' ? detail : detail?.message || err.message || 'Image upload failed';
      setError(errMsg);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-[#071739] mb-2">Live Face Verification</h1>
        <p className="text-[#4B6382] text-lg">
          {useFileUpload ? 'Upload a clear photo of your face' : 'Please look directly at the camera'}
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-[#A4B5C4]/40 overflow-hidden w-full max-w-2xl p-6 relative">
        <div className="flex justify-end mb-4">
          {/* Toggle Button for Camera/Upload */}
          <button 
            onClick={() => setUseFileUpload(!useFileUpload)}
            className="flex items-center gap-2 text-sm font-semibold text-[#071739] bg-[#f2f3ff] px-4 py-2 rounded-xl hover:bg-[#e2e7ff] transition"
          >
            {useFileUpload ? <Camera className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
            {useFileUpload ? 'Use Camera' : 'Upload Image'}
          </button>
        </div>

        <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center shadow-inner">
          {!useFileUpload ? (
            <>
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user", width: 1280, height: 720 }}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-[6px] border-[#071739]/40 rounded-2xl anim-face-oval pointer-events-none z-10 m-8" style={{borderRadius: '50%', width: '50%', height: '80%', margin: 'auto'}}></div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400 w-full h-full">
              <Upload className="w-16 h-16 mb-4 opacity-50" />
              <p>Select a portrait image</p>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          )}

          {success && (
            <div className="absolute inset-0 bg-emerald-900/80 flex flex-col items-center justify-center text-white z-20">
              <CheckCircle2 className="w-20 h-20 text-emerald-400 mb-4" />
              <h2 className="text-2xl font-bold">Face Captured Successfully</h2>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-4 bg-rose-50 text-rose-700 rounded-xl flex items-center gap-3 border border-rose-200">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <p className="font-medium">{error}</p>
          </div>
        )}

        {!useFileUpload && !success && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={handleCapture}
              disabled={capturing}
              className="bg-[#071739] hover:bg-[#007bb9] text-white px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-[#071739]/30 transition disabled:opacity-50 flex items-center gap-3"
            >
              <Camera className="w-6 h-6" />
              {capturing ? 'Capturing...' : 'Capture Photo'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}



