import React, { useState } from 'react';
import { Upload, Scan, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function PassportScanner({ sessionId, onPassportScanned }) {
  const [scanning, setScanning] = useState(false);
  const [useMockMrz, setUseMockMrz] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [passportData, setPassportData] = useState(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setScanning(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      if (useMockMrz) {
        formData.append('mrz_text', 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F3004157ZE184226B<<<<<10');
      }

      const res = await axios.post(`http://127.0.0.1:8001/kiosk/session/${sessionId}/passport`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess(true);
      setPassportData(res.data.passport);
      setTimeout(() => onPassportScanned(res.data), 2500);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || 'Passport scan failed');
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-4xl mx-auto w-full">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-[#071739] mb-2">Scan Passport</h1>
        <p className="text-[#4B6382] text-lg">Upload an image of your passport data page</p>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-[#A4B5C4]/40 overflow-hidden w-full max-w-2xl p-6 relative">
        <div className="relative aspect-[3/2] bg-slate-100 rounded-2xl overflow-hidden flex flex-col items-center justify-center border-2 border-dashed border-[#A4B5C4] hover:border-[#071739] transition-colors group">

          {!scanning && !success && (
            <>
              <div className="p-4 bg-white rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
                <Scan className="w-10 h-10 text-[#071739]" />
              </div>
              <p className="text-slate-600 font-medium mb-2">Click or drag image here</p>
              <p className="text-sm text-slate-400">Make sure the MRZ (bottom lines) and photo are clearly visible</p>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </>
          )}

          {scanning && (
            <div className="flex flex-col items-center text-[#071739]">
              <div className="w-full absolute inset-0 overflow-hidden pointer-events-none opacity-30 bg-[#E3C39D]/10">
                <div className="w-full h-2 bg-[#A68868] absolute left-0 anim-laser"></div>
              </div>
              <Scan className="w-16 h-16 animate-pulse mb-4" />
              <p className="font-bold text-lg animate-pulse">Scanning Document...</p>
              <p className="text-sm text-[#071739]/70 mt-2">Extracting face and reading MRZ</p>
            </div>
          )}

          {success && passportData && (
            <div className="absolute inset-0 bg-[#E3C39D]/20 p-6 flex flex-col justify-center text-[#071739]">
              <div className="flex items-center gap-3 text-emerald-700 mb-6 font-bold text-xl border-b border-emerald-200 pb-4">
                <CheckCircle2 className="w-8 h-8" />
                Passport Captured
              </div>

              <div className="grid grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Name</p>
                  <p className="font-semibold text-lg">{passportData.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Passport No.</p>
                  <p className="font-mono-num font-semibold text-lg">{passportData.passport_number}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Nationality</p>
                  <p className="font-semibold">{passportData.nationality}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">DOB</p>
                  <p className="font-semibold">{passportData.date_of_birth}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {!scanning && !success && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <input
              type="checkbox"
              id="mock-mrz"
              checked={useMockMrz}
              onChange={(e) => setUseMockMrz(e.target.checked)}
              className="w-4 h-4 text-[#071739]"
            />
            <label htmlFor="mock-mrz" className="text-sm font-medium text-slate-600 cursor-pointer">
              Bypass OCR (Inject Demo MRZ Data)
            </label>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-rose-50 text-rose-700 rounded-xl flex items-center gap-3 border border-rose-200">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <p className="font-medium">
              {typeof error === 'string' ? error : JSON.stringify(error)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}




