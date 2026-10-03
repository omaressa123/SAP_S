import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from './components/Header';
import FaceCapture from './components/FaceCapture';
import PassportScanner from './components/PassportScanner';
import VerificationResult from './components/VerificationResult';

export default function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const startSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.post('http://127.0.0.1:8001/kiosk/session', {
        kiosk_id: 'KIOSK-01',
        flight_id: 'GV101'
      });
      setSessionId(res.data.session_id);
      setCurrentStep(2); // Move to Face Scan
    } catch (err) {
      console.error(err);
      setError('Could not connect to kiosk service. Ensure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleFaceCaptured = (data) => {
    console.log('Face captured', data);
    setCurrentStep(3); // Move to Passport Scan
  };

  const handlePassportScanned = (data) => {
    console.log('Passport scanned', data);
    setCurrentStep(4); // Move to Verification
  };

  const handleVerificationComplete = () => {
    setCurrentStep(5); // Move to Pass Gate
  };

  return (
    <div className="min-h-screen bg-[#faf8ff] text-[#071739] flex flex-col font-sans">
      <Header currentStep={currentStep} onStepChange={setCurrentStep} />

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Background gradient orb */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#071739]/5 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

        {currentStep === 1 && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-3xl mx-auto">
            <div className="bg-white p-4 rounded-3xl shadow-sm mb-8 inline-block animate-bounce">
              <span className="text-4xl">👋</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#071739] to-[#0092dd]">Entry Security Gate</span>
            </h1>
            <p className="text-[#4B6382] text-xl mb-12 font-medium max-w-2xl leading-relaxed">
              Experience seamless entry using secure biometric verification. Please have your passport ready.
            </p>

            {error && (
              <div className="mb-8 p-4 bg-rose-50 text-rose-700 rounded-xl border border-rose-200">
                {error}
              </div>
            )}

            <button
              onClick={startSession}
              disabled={loading}
              className="bg-[#071739] hover:bg-[#007bb9] text-white px-10 py-5 rounded-2xl font-bold text-xl shadow-xl shadow-[#071739]/30 transition hover:-translate-y-1 active:translate-y-0 disabled:opacity-70 disabled:hover:translate-y-0 flex items-center justify-center min-w-[280px]"
            >
              {loading ? 'Connecting...' : 'Tap to Start'}
            </button>
          </div>
        )}

        {currentStep === 2 && (
          <FaceCapture sessionId={sessionId} onFaceCaptured={handleFaceCaptured} />
        )}

        {currentStep === 3 && (
          <PassportScanner sessionId={sessionId} onPassportScanned={handlePassportScanned} />
        )}

        {currentStep === 4 && (
          <VerificationResult sessionId={sessionId} onComplete={handleVerificationComplete} />
        )}

        {currentStep === 5 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-32 h-32 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-8 mx-auto anim-bob shadow-lg shadow-emerald-100/50">
              <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h1 className="text-4xl font-extrabold text-[#071739] mb-4">Gate Open</h1>
            <p className="text-xl text-[#4B6382] mb-8">Please proceed through the turnstile and have a safe flight!</p>
            <button
              onClick={() => {
                setSessionId(null);
                setCurrentStep(1);
              }}
              className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-800 transition"
            >
              Finish (Next Passenger)
            </button>
          </div>
        )}
      </main>
    </div>
  );
}


