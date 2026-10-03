import React from "react";

export default function Header({ currentStep, onStepChange }) {
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-[#A4B5C4]/50 px-6 lg:px-8 py-3.5 shadow-sm sticky top-0 z-40">
 <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
  
  <div className="flex items-center gap-3.5 cursor-pointer" >
   <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#071739] to-[#4B6382] flex items-center justify-center text-white shadow-md shadow-[#071739]/25">
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
     <path d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
     </path>
    </svg>
   </div>
   <div>
    <div className="flex items-center gap-2">
     <span className="text-xl font-extrabold tracking-tight text-[#071739]">
      AEROGATE
     </span>
     <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#071739]/10 text-[#071739] border border-[#071739]/20 tracking-wider">
      GATE B22
     </span>
    </div>
    <p className="text-xs text-[#4B6382] font-medium">
     Terminal 2 • International Departures
    </p>
   </div>
  </div>
  
  <nav className="hidden md:flex items-center gap-2 text-sm font-semibold">
   
   <button className="px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-all bg-[#071739] text-white shadow-sm shadow-[#071739]/30 hover:opacity-95" id="step-nav-1" >
    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
     1
    </span>
    <span className="">
     Method
    </span>
   </button>
   <span className="text-slate-300 font-bold px-0.5">
    ›
   </span>
   
   <button className="px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-all bg-slate-100 text-slate-500 hover:bg-slate-200" id="step-nav-2" >
    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs">
     2
    </span>
    <span className="">
     Scan Document
    </span>
   </button>
   <span className="text-slate-300 font-bold px-0.5">
    ›
   </span>
   
   <button className="px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-all bg-slate-100 text-slate-500 hover:bg-slate-200" id="step-nav-3" >
    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs">
     3
    </span>
    <span className="">
     Verification
    </span>
   </button>
   <span className="text-slate-300 font-bold px-0.5">
    ›
   </span>
   
   <button className="px-4 py-2 rounded-xl flex items-center gap-2 font-bold transition-all bg-slate-100 text-slate-500 hover:bg-slate-200" id="step-nav-4" >
    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs">
     4
    </span>
    <span className="">
     Pass Gate
    </span>
   </button>
  </nav>
  
  <div className="flex items-center gap-3">
   
   <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs font-bold text-slate-600 border border-slate-200/80">
    <button className="px-2.5 py-1 bg-white text-slate-900 rounded-lg shadow-sm">
     EN
    </button>
    <button className="px-2.5 py-1 hover:text-slate-900 transition">
     ES
    </button>
    <button className="px-2.5 py-1 hover:text-slate-900 transition">
     FR
    </button>
    <button className="px-2.5 py-1 hover:text-slate-900 transition">
     العربية
    </button>
   </div>
   
   <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#071739] text-xs font-bold transition active:scale-95 border border-slate-200/60" >
    <span className="material-symbols-outlined text-base">
     support_agent
    </span>
    <span className="">
     Assistance
    </span>
   </button>
  </div>
 </div>
</header>
  );
}

