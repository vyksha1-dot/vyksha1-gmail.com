import React from 'react';
import { motion } from 'motion/react';
import { Logo } from './Logo';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { isAfterHours } from '../lib/pricing';

export function LandingPage({ onLogin, onReport, isLoading }: { onLogin: () => void, onReport: () => void, isLoading: boolean }) {
  return (
    <div className="min-h-screen bg-paper text-ink overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[50] border-b-4 border-ink bg-paper/80 backdrop-blur-md px-8 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Logo className="w-20 h-20 md:w-32 md:h-32" />
        </div>
        <div className="flex gap-4 md:gap-8 items-center">
          <a href="tel:502-489-7790" className="hidden sm:flex items-center gap-2 px-3 py-1 bg-ink text-neon border-2 border-ink font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-transform">
             <div className="w-2 h-2 bg-neon animate-pulse rounded-full" />
             502-489-7790
          </a>
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
      <section className="pt-48 pb-16 px-8 min-h-screen flex flex-col items-start border-b-[20px] border-ink">
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

        <div className="relative z-10 space-y-8">
          <h1 className="text-[clamp(3rem,10vw,10rem)] leading-[0.82] font-black tracking-[-0.04em] uppercase">
            Quick Fix<br />
            <span className="text-neon bg-ink pr-6">Pothole.</span><br />
            Done.
          </h1>
          
          <div className="flex flex-col md:flex-row gap-8 items-start md:items-end justify-between">
            <p className="text-2xl font-bold uppercase tracking-tighter max-w-xl">
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
                <a 
                  href="tel:502-489-7790" 
                  className="flex items-center gap-3 px-4 py-2 border-4 border-ink bg-neon font-black uppercase text-xl italic tracking-tighter hover:scale-105 transition-transform"
                >
                  <div className="w-4 h-4 bg-ink flex items-center justify-center rounded-sm">
                     <div className="w-1 h-1 bg-neon animate-ping" />
                  </div>
                  502-489-7790
                </a>
                <div className="flex items-center gap-2 px-2 py-1 border-2 border-ink bg-yellow-400 font-black uppercase text-[8px]">
                  <AlertTriangle className="w-3 h-3" />
                  Advisory: Rain, Roadblocks, or Heavy Traffic may delay service
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Jobs Completed", val: "2,481+" },
            { label: "Avg. Response", val: "30m" },
            { label: "Success Rate", val: "99.8%" },
            { label: "Warranty", val: "12mo" }
          ].map((stat, i) => (
            <div key={i} className="border-4 border-ink p-4 bg-paper group hover:bg-neon transition-colors">
              <p className="text-[10px] font-black uppercase opacity-50 mb-1 group-hover:opacity-100">{stat.label}</p>
              <p className="text-3xl font-black italic tracking-tighter">{stat.val}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 px-8 bg-ink text-paper overflow-hidden relative border-b-4 border-neon">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-start">
          <div className="flex-1 space-y-6 relative z-10">
            <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">
              How the <br/><span className="text-neon">rapid fix</span> works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              {[
                { n: "01", t: "Scan & Tag", d: "Snap a photo. Our system tags GPS and severity." },
                { n: "02", t: "Dispatch", d: "Technician arrives within minutes. Track live." },
                { n: "03", t: "Fix", d: "Cleaned, filled, and sealed in 60 minutes." }
              ].map((step, i) => (
                <div key={i} className="flex flex-col gap-2 group">
                  <span className="text-3xl font-black text-neon opacity-20 group-hover:opacity-100 transition-opacity">{step.n}</span>
                  <div>
                    <h3 className="text-lg font-black uppercase mb-1">{step.t}</h3>
                    <p className="text-[10px] font-bold uppercase opacity-60 leading-tight">{step.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 px-8 bg-paper">
        <div className="text-center mb-12">
          <div className="inline-block px-4 py-1 bg-ink text-neon font-black uppercase text-[10px] tracking-widest mb-2">Pricing Model</div>
          <h2 className="text-5xl font-black uppercase tracking-tighter">Flat rate speed.</h2>
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
            <div key={i} className="border-4 border-ink p-6 bg-paper flex flex-col items-center text-center space-y-6 hover:-translate-y-2 transition-transform bold-shadow relative overflow-hidden group">
              {isAfterHours() && (
                <div className="absolute top-0 right-0 bg-ink text-neon px-4 py-0.5 font-black text-[8px] uppercase rotate-45 translate-x-4 translate-y-1">Night Rate x2</div>
              )}
              <h3 className="text-xl font-black uppercase tracking-tighter">{tier.name}</h3>
              <div className={cn(
                "font-black leading-none tracking-tighter flex items-start",
                tier.standard === "AFTER INSPECTION" ? "text-2xl" : "text-6xl"
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
              <ul className="space-y-2 w-full border-y-2 border-ink py-4 font-bold uppercase text-[10px] opacity-60">
                {tier.feat.map((f, j) => <li key={j}>{f}</li>)}
              </ul>
              <button 
                onClick={onReport}
                className="w-full py-3 bg-ink text-paper font-black uppercase text-[10px] tracking-[0.2em] hover:bg-neon hover:text-ink transition-colors"
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
              <a href="mailto:vik@quickfixpothole.com" className="hover:text-neon text-paper transition-colors">vik@quickfixpothole.com</a>
              <a href="tel:502-489-7790" className="text-neon text-xl font-black italic tracking-tighter">502-489-7790</a>
              <span className="text-[8px] font-black opacity-40 uppercase tracking-widest">24/7 Dispatch Hotline</span>
            </div>
          </div>
        </div>
        <div className="mt-24 pt-12 border-t border-paper/10 flex justify-between items-center text-[10px] font-black uppercase opacity-20">
          <span>&copy; 2026 Pothole Rapid Response Force</span>
          <span>Designed for Speed</span>
        </div>
      </footer>

      {/* Bright Bottom Banner */}
      <div className="bg-neon text-ink border-t-8 border-ink py-4 overflow-hidden relative">
        <div className="flex animate-marquee-slower whitespace-nowrap">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="text-4xl font-black uppercase tracking-tighter mx-4">
              WWW.QUICKFIXPOTHOLE.COM <span className="text-ink/20 px-4">⚡</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
