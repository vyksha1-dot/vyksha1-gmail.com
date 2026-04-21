import React from 'react';
import { motion } from 'motion/react';

export const Logo = ({ className = "w-12 h-12" }: { className?: string }) => {
  return (
    <div className={`relative ${className} group`}>
      {/* Background shadow/offset block */}
      <div className="absolute inset-0 bg-ink translate-x-1 translate-y-1 transition-transform group-hover:translate-x-1.5 group-hover:translate-y-1.5" />
      
      {/* Main Container */}
      <div className="absolute inset-0 bg-paper border-4 border-ink flex items-center justify-center overflow-hidden">
        {/* Animated Grid lines in background - slightly more subtle */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="w-full h-full grid grid-cols-4 grid-rows-4">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="border-[0.5px] border-ink" />
            ))}
          </div>
        </div>

        {/* Brand Image Logo */}
        <motion.div
          initial={{ scale: 0.9, rotate: -5 }}
          animate={{ scale: 1, rotate: 0 }}
          whileHover={{ scale: 1.1, rotate: 3 }}
          className="relative z-10 w-full h-full p-1"
        >
          <img 
            src="/logo.png" 
            alt="Quick Pothole Fix Logo" 
            className="w-full h-full object-contain"
            onError={(e) => {
              // Fallback if logo.png is missing
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center font-black text-[10px] uppercase text-center p-1">Upload logo.png to public/</div>';
            }}
          />
        </motion.div>
      </div>
      
      {/* Status Dot */}
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-paper border-2 border-ink rounded-full z-20">
        <div className="w-full h-full rounded-full bg-neon animate-pulse" />
      </div>
    </div>
  );
};
