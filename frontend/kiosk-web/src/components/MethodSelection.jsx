import React from "react";

export default function MethodSelection({ onSelectPassport }) {
  return (
    <section className="h-auto min-h-fit overflow-visible transition-all duration-300 ease-out" id="screen-1">

      <div className="text-center max-w-2xl mx-auto mb-10">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#CDD5DB] text-[#071739] font-extrabold text-xs uppercase tracking-wider mb-4 border border-[#071739]/20 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-[#071739]">
          </span>
          Step 1 of 4 • Identification
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-[#071739] tracking-tight mb-4">
          Welcome. Please choose how you would like to identify yourself.
        </h2>
        <div className="inline-flex items-center gap-2 text-slate-600 font-semibold text-xs sm:text-sm bg-white px-4 py-2 rounded-full border border-slate-200 shadow-xs">
          <svg className="w-4 h-4 text-[#071739]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
            </path>
            <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
            </path>
          </svg>
          <span className="">
            Stand on the yellow floor markings in front of the kiosk
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">

        <div className="group relative bg-white border-2 border-[#CDD5DB] hover:border-[#071739] rounded-3xl p-8 cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between transform hover:-translate-y-1" >
          <div className="absolute top-6 right-6">
            <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-sky-100 text-[#071739]">
              FASTEST • 3s
            </span>
          </div>
          <div>
            <div className="w-14 h-14 rounded-2xl bg-sky-50 text-[#071739] flex items-center justify-center mb-6 group-hover:scale-110 transition duration-300">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                </path>
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              Boarding Pass / QR Code
            </h3>
            <p className="text-slate-500 text-sm mb-6">
              On mobile phone screen or printed paper airline ticket
            </p>

            <div className="bg-[#faf8ff] rounded-2xl p-6 h-52 flex flex-col items-center justify-center border border-slate-100 relative overflow-hidden">
              <div className="w-48 h-8 bg-sky-100/70 border-t-2 border-sky-400 rounded-lg absolute bottom-5 flex items-center justify-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-sky-700">
                  Scanner Glass Target
                </span>
              </div>
              <div className="w-24 h-36 bg-white border-2 border-slate-800 rounded-2xl shadow-lg flex flex-col items-center p-2 z-10 anim-bob">
                <div className="w-8 h-1 bg-slate-300 rounded-full mb-3">
                </div>
                <div className="w-14 h-14 bg-slate-900 rounded-lg p-1.5 flex items-center justify-center">
                  <div className="grid grid-cols-3 gap-0.5 w-full h-full">
                    <span className="bg-white">
                    </span>
                    <span className="bg-slate-900">
                    </span>
                    <span className="bg-white">
                    </span>
                    <span className="bg-slate-900">
                    </span>
                    <span className="bg-white">
                    </span>
                    <span className="bg-slate-900">
                    </span>
                    <span className="bg-white">
                    </span>
                    <span className="bg-white">
                    </span>
                    <span className="bg-white">
                    </span>
                  </div>
                </div>
                <span className="text-[8px] font-bold text-slate-500 mt-2 font-mono">
                  QR-082
                </span>
              </div>
            </div>
          </div>
          <button className="mt-8 w-full py-4 rounded-2xl bg-[#071739] group-hover:bg-[#004b73] text-white font-bold text-base flex items-center justify-center gap-2 shadow-md shadow-[#071739]/25 transition">
            <span className="">
              Select QR Code
            </span>
            <svg className="w-5 h-5 transition group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
              </path>
            </svg>
          </button>
        </div>

        <div className="group relative bg-white border-2 border-[#CDD5DB] hover:border-[#071739] rounded-3xl p-8 cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between transform hover:-translate-y-1" >
          <div className="absolute top-6 right-6">
            <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
              UNIVERSAL • E-CHIP
            </span>
          </div>
          <div>
            <div className="w-14 h-14 rounded-2xl bg-sky-50 text-[#071739] flex items-center justify-center mb-6 group-hover:scale-110 transition duration-300">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
                </path>
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              Passport / Travel ID
            </h3>
            <p className="text-slate-500 text-sm mb-6">
              Physical booklet with photo page laid flat on reader glass
            </p>

            <div className="bg-[#faf8ff] rounded-2xl p-6 h-52 flex flex-col items-center justify-center border border-slate-100 relative overflow-hidden">
              <div className="w-52 h-8 bg-sky-100/70 border-t-2 border-sky-400 rounded-lg absolute bottom-5 flex items-center justify-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-sky-700">
                  Illuminated Platen
                </span>
              </div>
              <div className="w-48 h-28 bg-[#071739] border-2 border-slate-700 rounded-xl shadow-lg flex items-center justify-between p-2 z-10 anim-bob">
                <div className="w-1/2 h-full bg-slate-100 rounded-lg p-2 flex flex-col justify-between">
                  <div className="w-6 h-7 bg-slate-300 rounded">
                  </div>
                  <div className="space-y-1">
                    <div className="w-14 h-1.5 bg-slate-400 rounded">
                    </div>
                    <div className="w-10 h-1 bg-slate-300 rounded">
                    </div>
                  </div>
                </div>
                <div className="w-1/2 h-full flex flex-col items-center justify-center text-slate-400 pl-1">
                  <div className="w-8 h-8 rounded-full border-2 border-sky-400 flex items-center justify-center">
                    <span className="w-2.5 h-2.5 bg-sky-400 rounded-full animate-ping">
                    </span>
                  </div>
                  <span className="text-[8px] text-sky-300 mt-1 uppercase tracking-wider font-bold">
                    ICAO 9303
                  </span>
                </div>
              </div>
            </div>
          </div>
          <button className="mt-8 w-full py-4 rounded-2xl bg-[#071739] group-hover:bg-[#004b73] text-white font-bold text-base flex items-center justify-center gap-2 shadow-md shadow-[#071739]/25 transition">
            <span className="">
              Select Passport
            </span>
            <svg className="w-5 h-5 transition group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
              </path>
            </svg>
          </button>
        </div>
      </div>

      <div className="mt-12 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-600">
        <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition shadow-xs" >
          <svg className="w-4 h-4 text-[#071739]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
            </path>
          </svg>
          <span className="">
            Audio Directions
          </span>
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 hover:bg-slate-50 transition shadow-xs" >
          <svg className="w-4 h-4 text-[#071739]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
            </path>
            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
            </path>
          </svg>
          <span className="" id="contrast-btn-text">
            High Contrast Mode
          </span>
        </button>
        <span className="text-slate-300">
          •
        </span>
        <span className="text-slate-500 font-medium">
          ICAO 9303 Compliant • Encrypted Session (Biometrics deleted after passage)
        </span>
      </div>
    </section>
  );
}

