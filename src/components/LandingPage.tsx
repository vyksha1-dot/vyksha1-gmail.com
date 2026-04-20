import React from 'react';
import { motion } from 'motion/react';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { isAfterHours } from '../lib/pricing';

export function LandingPage({ onLogin, onReport, isLoading }: { onLogin: () => void, onReport: () => void, isLoading: boolean }) {
  return (
    <div className="min-h-screen bg-paper text-ink overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[50] border-b-4 border-ink bg-paper/80 backdrop-blur-md px-12 py-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-neon p-2 border-2 border-ink">
            <Clock className="w-6 h-6" />
          </div>
          <span className="font-black text-2xl uppercase tracking-tighter">QUICK FIX</span>
        </div>
        <div className="flex gap-8 items-center">
          <button 
            onClick={onLogin} 
            disabled={isLoading}
            className="text-[10px] font-black uppercase tracking-widest opacity-30 hover:opacity-100 transition-opacity disabled:opacity-10"
          >
            {isLoading ? 'Wait...' : 'Admin Login'}
          </button>
          <button 
            onClick={onReport} 
            disabled={isLoading}
            className="px-6 py-2 bg-neon border-4 border-ink bold-shadow font-black uppercase text-xs tracking-widest hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            Report Now
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-48 pb-24 px-12 min-h-screen flex flex-col justify-center border-b-[20px] border-ink">
        <motion.div
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="absolute inset-0 opacity-10 pointer-events-none"
        >
          <div className="grid grid-cols-12 grid-rows-12 gap-0 w-full h-full">
            {Array.from({ length: 144 }).map((_, i) => (
              <div key={i} className="border-[0.5px] border-ink" />
            ))}
          </div>
        </motion.div>

        <div className="relative z-10 space-y-12">
          <h1 className="text-[clamp(6rem,18vw,24rem)] leading-[0.78] font-black tracking-[-0.04em] uppercase">
            Quick Fix<br />
            <span className="text-neon bg-ink pr-8">Pothole.</span><br />
            Done.
          </h1>
          
          <div className="flex flex-col md:flex-row gap-12 items-start md:items-end justify-between">
            <p className="text-3xl font-bold uppercase tracking-tighter max-w-xl">
              Professional on-demand pothole repair. 
              Rapid response dispatch. Targeted 60-min fix. 
              <span className="text-neon bg-ink px-1 mx-1 italic underline decoration-2 underline-offset-4">Weather & Traffic permitting.</span>
            </p>
            <div className="flex flex-col items-end gap-2">
              <span className="text-xs font-black opacity-40 uppercase tracking-[0.4em]">Operations Status</span>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-3 px-4 py-2 border-4 border-ink bg-green-400 font-black uppercase text-sm">
                  <div className="w-3 h-3 bg-ink animate-pulse rounded-full" />
                  Live in Louisville, KY
                </div>
                <div className="flex items-center gap-2 px-2 py-1 border-2 border-ink bg-yellow-400 font-black uppercase text-[8px]">
                  <AlertTriangle className="w-3 h-3" />
                  Advisory: Rain, Roadblocks, or Heavy Traffic may delay service
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: "Jobs Completed", val: "2,481+" },
            { label: "Avg. Response", val: "14m" },
            { label: "Success Rate", val: "99.8%" },
            { label: "Warranty", val: "12mo" }
          ].map((stat, i) => (
            <div key={i} className="border-4 border-ink p-6 bg-paper group hover:bg-neon transition-colors">
              <p className="text-[10px] font-black uppercase opacity-50 mb-1 group-hover:opacity-100">{stat.label}</p>
              <p className="text-5xl font-black italic tracking-tighter">{stat.val}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-32 px-12 bg-ink text-paper overflow-hidden relative">
        <div className="flex flex-col md:flex-row gap-24 items-center">
          <div className="flex-1 space-y-12 relative z-10">
            <h2 className="text-8xl font-black uppercase tracking-tighter leading-none">
              How the <br/><span className="text-neon">rapid fix</span> works
            </h2>
            <div className="space-y-12 max-w-lg">
              {[
                { n: "01", t: "Scan & Tag", d: "Snap a photo of the pothole. Our system automatically tags the GPS location and estimated severity." },
                { n: "02", t: "Instant Dispatch", d: "A technician is dispatched within 5 minutes. You get a live countdown link to track their arrival." },
                { n: "03", t: "60-Min Repair", d: "The hole is cleaned, filled, and sealed using professional-grade quick-dry asphalt. Complete in 1 hour." }
              ].map((step, i) => (
                <div key={i} className="flex gap-8 group">
                  <span className="text-5xl font-black text-neon opacity-20 group-hover:opacity-100 transition-opacity">{step.n}</span>
                  <div>
                    <h3 className="text-2xl font-black uppercase mb-2">{step.t}</h3>
                    <p className="text-sm font-bold uppercase opacity-60 leading-relaxed">{step.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 relative">
            <div className="aspect-square border-[10px] border-paper transform rotate-3 overflow-hidden bold-shadow">
              <img 
                src="https://picsum.photos/seed/pothole_fix/1200/1200" 
                alt="Pothole repair in action" 
                className="w-full h-full object-cover grayscale"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-neon/20 mix-blend-multiply" />
            </div>
            {/* Floating UI Elements */}
            <motion.div 
              animate={{ y: [0, -20, 0], rotate: [-2, 2, -2] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="absolute -top-12 -left-12 bg-paper text-ink p-4 border-4 border-ink bold-shadow"
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-neon fill-ink" />
                <span className="text-[10px] font-black uppercase">Timer Active</span>
              </div>
              <div className="text-3xl font-black italic">42:19</div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-32 px-12 bg-paper">
        <div className="text-center mb-24">
          <div className="inline-block px-4 py-1 bg-ink text-neon font-black uppercase text-[10px] tracking-widest mb-4">Pricing Model</div>
          <h2 className="text-7xl font-black uppercase tracking-tighter">Flat rate speed.</h2>
          <div className="mt-4 flex flex-col items-center gap-2">
             <div className="flex items-center gap-4 border-2 border-ink p-2 px-4 bg-paper font-black uppercase text-xs">
                <span className={cn(isAfterHours() ? "opacity-30" : "text-ink")}>Standard: 6AM-5PM</span>
                <div className="w-10 h-0.5 bg-ink" />
                <span className={cn(!isAfterHours() ? "opacity-30" : "text-neon bg-ink px-2")}>After Hours: 5PM-6AM</span>
             </div>
             <p className="text-[10px] font-bold uppercase opacity-50 italic">Night dispatch rates double to cover hazard pay & logistics</p>
             <p className="text-[10px] font-black uppercase text-red-500 bg-ink px-2 py-0.5">Note: All rates listed cover standard filling. Foundation setting requires custom quote.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { 
              name: "Small Pothole", 
              standard: "$299", 
              after: "$598",
              feat: ["Under 1ft diameter", "Standard Filling", "Quick Sealant"] 
            },
            { 
              name: "Medium Crack", 
              standard: "$499", 
              after: "$998",
              feat: ["Up to 3ft span", "Edge reinforcement", "Tamp compression"] 
            },
            { 
              name: "Danger Zone", 
              standard: "AFTER INSPECTION", 
              after: "AFTER INSPECTION",
              feat: ["Deep structural issues", "Foundation check", "High-traffic fill"] 
            }
          ].map((tier, i) => (
            <div key={i} className="border-4 border-ink p-12 bg-paper flex flex-col items-center text-center space-y-8 hover:-translate-y-4 transition-transform bold-shadow relative overflow-hidden group">
              {isAfterHours() && (
                <div className="absolute top-0 right-0 bg-ink text-neon px-4 py-1 font-black text-[10px] uppercase rotate-45 translate-x-4 translate-y-2">Night Rate x2</div>
              )}
              <h3 className="text-2xl font-black uppercase tracking-tighter">{tier.name}</h3>
              <div className={cn(
                "font-black leading-none tracking-tighter flex items-start",
                tier.standard === "AFTER INSPECTION" ? "text-3xl" : "text-[80px]"
              )}>
                {!isAfterHours() ? (
                  tier.standard === "AFTER INSPECTION" ? "AFTER INSPECTION" : (
                    <>
                      <span className="text-xl mt-4">$</span>
                      {tier.standard.replace('$', '')}
                    </>
                  )
                ) : (
                  tier.after === "AFTER INSPECTION" ? "AFTER INSPECTION" : (
                    <>
                      <span className="text-xl mt-4">$</span>
                      {tier.after.replace('$', '')}
                    </>
                  )
                )}
              </div>
              <div className="flex flex-col items-center gap-1 opacity-50">
                <p className="text-[10px] font-black uppercase line-through">
                  {tier.standard === "AFTER INSPECTION" ? "" : (isAfterHours() ? `Day: ${tier.standard}` : `Night: ${tier.after}`)}
                </p>
              </div>
              <ul className="space-y-4 w-full border-y-2 border-ink py-8 font-bold uppercase text-xs opacity-60">
                {tier.feat.map((f, j) => <li key={j}>{f}</li>)}
              </ul>
              <button 
                onClick={onReport}
                className="w-full py-4 bg-ink text-paper font-black uppercase text-xs tracking-[0.3em] hover:bg-neon hover:text-ink transition-colors"
              >
                Book This Repair
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink text-paper py-24 px-12 border-t-[20px] border-neon">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-24">
          <div className="col-span-2 space-y-8">
            <h2 className="text-5xl font-black tracking-tighter uppercase">QUICKFIXPOTHOLE.COM</h2>
            <p className="max-w-md font-bold uppercase text-xs opacity-40 leading-relaxed">
              Based in the heart of the city, we are the dedicated task force for urban road integrity. 
              Our mission is zero-delay pavement safety through cutting edge rapid-response tech.
            </p>
          </div>
          <div className="space-y-6">
            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">Legal</h4>
            <div className="flex flex-col gap-4 font-black uppercase text-xs">
              <a href="#" className="hover:text-neon">Safety Standards</a>
              <a href="#" className="hover:text-neon">Terms of Speed</a>
              <a href="#" className="hover:text-neon">Privacy Policy</a>
            </div>
          </div>
          <div className="space-y-6 text-right">
            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">Connect</h4>
            <div className="flex flex-col gap-4 font-black uppercase text-xs items-end">
              <a href="#" className="hover:text-neon">vik@quickfixpothole.com</a>
              <a href="#" className="hover:text-neon">Dispatch Hotline</a>
            </div>
          </div>
        </div>
        <div className="mt-24 pt-12 border-t border-paper/10 flex justify-between items-center text-[10px] font-black uppercase opacity-20">
          <span>&copy; 2026 Pothole Rapid Response Force</span>
          <span>Designed for Speed</span>
        </div>
      </footer>
    </div>
  );
}
