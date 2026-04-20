import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, MapPin, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { getPrice } from '../lib/pricing';

export function ReportModal({ 
  isOpen, 
  onClose, 
  onCapture, 
  onSubmit, 
  isReporting, 
  isValidatingImage, 
  reportImage, 
  reportLocation, 
  reportAddress, 
  setReportAddress, 
  reportSeverity, 
  setReportSeverity, 
  reportDescription, 
  setReportDescription, 
  reportMeasurements, 
  fileInputRef,
  reportName,
  setReportName,
  reportPhone,
  setReportPhone,
  reportEmail,
  setReportEmail
}: any) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="relative bg-white w-full max-w-lg border-4 border-ink overflow-hidden bold-shadow flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b-4 border-ink flex items-center justify-between bg-neon">
              <h3 className="text-2xl font-black uppercase tracking-tighter">1HR REPAIR REQUEST</h3>
              <button onClick={onClose} className="p-2 hover:bg-ink hover:text-paper transition-colors border-2 border-ink">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="bg-ink text-neon text-[10px] font-black uppercase tracking-[0.2em] py-2 text-center animate-pulse">
              ⚡ 60-Minute Rapid Response Target ⚡
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto">
              {/* Reporter Info */}
              <div className="space-y-4 pt-2">
                <h4 className="text-xs font-black uppercase tracking-widest border-b-2 border-ink pb-2 mb-4">Reporter Information</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest mb-1 block opacity-50">Full Name</label>
                    <input 
                      type="text"
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      placeholder="YOUR NAME..."
                      className="w-full p-3 bg-muted border-2 border-ink font-bold uppercase text-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block opacity-50">Phone Number</label>
                      <input 
                        type="tel"
                        value={reportPhone}
                        onChange={(e) => setReportPhone(e.target.value)}
                        placeholder="PHONE..."
                        className="w-full p-3 bg-muted border-2 border-ink font-bold uppercase text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest mb-1 block opacity-50">Email (Receipt)</label>
                      <input 
                        type="email"
                        value={reportEmail}
                        onChange={(e) => setReportEmail(e.target.value)}
                        placeholder="EMAIL..."
                        className="w-full p-3 bg-muted border-2 border-ink font-bold uppercase text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 1: Photos */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest border-b-2 border-ink pb-2">Step 1: Visual Evidence</h4>
                <div className="relative aspect-video bg-muted border-4 border-dashed border-ink/20 flex flex-col items-center justify-center overflow-hidden">
                  {reportImage ? (
                    <>
                      <img src={reportImage} className="w-full h-full object-cover" alt="Capture" referrerPolicy="no-referrer" />
                      <button 
                        onClick={() => {
                          if (fileInputRef.current) fileInputRef.current.value = '';
                          onCapture({ target: { files: [] } } as any);
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-paper border-2 border-ink hover:bg-ink transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isValidatingImage}
                      className="flex flex-col items-center gap-2 group transition-all"
                    >
                      <div className="p-4 bg-neon border-4 border-ink bold-shadow group-hover:scale-110 transition-transform">
                        {isValidatingImage ? (
                          <div className="w-8 h-8 border-4 border-ink/30 border-t-ink rounded-full animate-spin" />
                        ) : (
                          <Camera className="w-8 h-8" />
                        )}
                      </div>
                      <span className="font-black uppercase text-[10px] tracking-widest">
                        {isValidatingImage ? 'Analyzing Infrastructure...' : 'Capture Photo'}
                      </span>
                    </button>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={onCapture} 
                    className="hidden" 
                    accept="image/*" 
                    capture="environment" 
                  />
                </div>
              </div>

              {/* Step 2: Analysis */}
              {reportMeasurements && (
                <div className="p-4 bg-ink text-paper space-y-4 border-4 border-ink">
                  <div className="flex items-center gap-2 text-neon">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">AI STRUCTURAL AUDIT COMPLETE</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <p className="text-[8px] opacity-50 font-bold uppercase">Estimated Width</p>
                      <p className="text-xl font-black">{reportMeasurements.widthInches}"</p>
                    </div>
                    <div className="text-center border-x border-paper/20">
                      <p className="text-[8px] opacity-50 font-bold uppercase">Depth Zone</p>
                      <p className="text-xl font-black">{reportMeasurements.depthInches}"</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[8px] opacity-50 font-bold uppercase">Repair Tier</p>
                      <p className="text-xl font-black text-neon">{reportMeasurements.confidence > 0.8 ? 'Verified' : 'Review'}</p>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold uppercase opacity-50 leading-tight">
                    *AI estimates subject to field technician verification upon arrival.
                  </p>
                </div>
              )}

              {/* Step 3: Location */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest border-b-2 border-ink pb-2">Step 2: Dispatch Coordinates</h4>
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "p-3 border-4 border-ink",
                    reportLocation ? "bg-green-400" : "bg-muted animate-pulse"
                  )}>
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <input 
                      type="text"
                      value={reportAddress}
                      onChange={(e) => setReportAddress(e.target.value)}
                      placeholder={reportLocation ? "Fetching address..." : "Enter location name or address"}
                      className="w-full p-3 bg-muted border-2 border-ink font-bold uppercase text-xs"
                    />
                    <p className="text-[9px] font-bold opacity-40 uppercase">
                      {reportLocation ? `GPS: ${reportLocation.lat.toFixed(6)}, ${reportLocation.lng.toFixed(6)}` : 'Enable GPS for faster dispatch'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 4: Priority */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest border-b-2 border-ink pb-2">Step 3: Severity Rating</h4>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setReportSeverity(s)}
                      className={cn(
                        "py-3 border-4 border-ink font-black uppercase text-[10px] tracking-widest transition-all",
                        reportSeverity === s 
                          ? (s === 'high' ? 'bg-red-500 text-paper scale-105' : 'bg-neon scale-105')
                          : 'bg-paper opacity-50'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 5: Description */}
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest border-b-2 border-ink pb-2">Final Step: Observations</h4>
                <textarea 
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Damage details, hazards, nearby landmarks..."
                  className="w-full p-4 bg-muted border-4 border-ink font-bold uppercase text-xs h-32 focus:bg-paper transition-colors"
                />
              </div>

              {/* Submit */}
              <div className="bg-yellow-100 p-4 border-4 border-yellow-400 font-bold uppercase text-[9px] leading-tight">
                BY SUBMITTING THIS REPORT, YOU AGRE TO THE DISPATCH TERMS. OUR SQUAD TARGETS A 60-MINUTE ON-SITE ARRIVAL. AN EMAIL QUOTE WILL BE SENT IMMEDIATELY AFTER SITE INSPECTION.
              </div>
            </div>

            <div className="p-6 bg-paper border-t-4 border-ink mt-auto">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase opacity-40">ESTIMATED RESPONSE</span>
                <span className="text-xl font-black italic tracking-tighter">~14 MINUTES</span>
              </div>
              <button
                disabled={!reportImage || (!reportLocation && !reportAddress) || isReporting}
                onClick={onSubmit}
                className="w-full py-4 bg-neon text-ink border-4 border-ink font-black uppercase tracking-tighter text-xl bold-shadow disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
              >
                {isReporting ? (
                  <div className="w-6 h-6 border-4 border-ink/30 border-t-ink rounded-full animate-spin" />
                ) : (
                  <>CONFIRM QUICK FIX</>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
