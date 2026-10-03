import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertTriangle, ArrowRight, XCircle } from 'lucide-react';
import axios from 'axios';

export default function VerificationResult({ sessionId, onComplete }) {
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [resultData, setResultData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;

    const verifyIdentity = async () => {
      try {
        const res = await axios.post(`http://127.0.0.1:8001/kiosk/session/${sessionId}/verify`);
        if (!isMounted) return;
        
        if (res.data.verified) {
          setResultData(res.data);
          setStatus('success');
          
          // Forward the real extracted data to the central DB
          try {
            await axios.post('http://127.0.0.1:8000/api/v1/kiosk/register', {
              full_name: res.data.passenger.name,
              passport_number: res.data.passenger.passport,
              date_of_birth: res.data.passenger.date_of_birth,
              nationality: res.data.passenger.nationality,
              gender: res.data.passenger.gender,
              expiry_date: res.data.passenger.expiry_date,
              mrz_raw: res.data.passenger.mrz_raw
            });
            console.log('Saved to central database successfully!');
          } catch (dbErr) {
            console.error('Failed to save to central database', dbErr);
          }
          
        } else {
          setResultData(res.data);
          setErrorMsg(res.data.message || 'Verification failed. Faces do not match.');
          setStatus('error');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error(err);
        setErrorMsg(err.response?.data?.detail?.message || err.message || 'System error during verification');
        setStatus('error');
      }
    };

    // Add a slight delay for UI effect
    setTimeout(verifyIdentity, 1500);

    return () => { isMounted = false; };
  }, [sessionId]);
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-5xl mx-auto w-full">
      {status === 'verifying' && (
        <div className="text-center">
          <div className="relative w-32 h-32 mx-auto mb-8 flex items-center justify-center">
            <div className="absolute inset-0 border-4 border-slate-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-[#071739] border-t-transparent rounded-full animate-spin"></div>
            <ShieldCheck className="w-12 h-12 text-[#071739] opacity-50" />
          </div>
          <h2 className="text-3xl font-extrabold text-[#071739] mb-3">Verifying Identity</h2>
          <p className="text-slate-500 text-lg">Comparing live face with passport data securely...</p>
        </div>
      )}

      {status === 'success' && resultData && (
        <div className="w-full flex flex-col items-center animate-in fade-in zoom-in duration-500">
          <div className="bg-emerald-50 text-emerald-700 px-6 py-2 rounded-full font-bold text-sm mb-6 flex items-center gap-2 border border-emerald-200 shadow-sm">
            <ShieldCheck className="w-5 h-5" />
            Identity Verified - {Math.round(resultData.similarity * 100)}% Match
          </div>

          <h2 className="text-4xl font-extrabold text-[#071739] mb-2 text-center">Welcome, {resultData.passenger.name}</h2>
          <p className="text-slate-500 mb-10 text-center text-lg">Your identity has been securely verified.</p>

          <div className="bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-3xl shadow-2xl overflow-hidden w-full max-w-xl flex flex-col items-center justify-center p-12 text-white relative">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
            
            <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-md shadow-lg border border-white/30 animate-bounce">
              <ShieldCheck className="w-16 h-16 text-white" />
            </div>
            
            <h3 className="text-3xl font-black tracking-widest uppercase mb-2">Access Granted</h3>
            <p className="text-emerald-50 font-medium text-lg text-center max-w-xs">Entry Security Gate Open</p>
            
            <div className="mt-8 flex items-center gap-4 text-sm font-bold bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm border border-white/20">
              <span className="w-2 h-2 rounded-full bg-emerald-200 animate-ping"></span>
              Proceed to secure zone
            </div>
          </div>

          <div className="mt-12 w-full max-w-xl">
            <button 
              onClick={onComplete}
              className="w-full bg-[#071739] hover:bg-[#007bb9] text-white px-8 py-5 rounded-2xl font-bold text-xl shadow-xl shadow-[#071739]/30 transition hover:-translate-y-1 flex items-center justify-center gap-3"
            >
              Proceed Through Gate <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="w-full max-w-lg bg-white rounded-3xl p-10 text-center border-t-8 border-rose-600 shadow-2xl">
          <div className="w-24 h-24 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6 text-rose-600">
            <XCircle className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#071739] mb-2">Verification Failed</h2>
          <p className="text-rose-600 font-medium mb-8 bg-rose-50 p-4 rounded-xl border border-rose-100">{errorMsg}</p>
          
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-xl font-bold text-lg transition"
          >
            Start Over
          </button>
          
          <button className="w-full mt-3 flex items-center justify-center gap-2 py-4 text-[#071739] font-bold rounded-xl hover:bg-blue-50 transition">
            <AlertTriangle className="w-5 h-5" />
            Request Staff Assistance
          </button>
        </div>
      )}
    </div>
  );
}




