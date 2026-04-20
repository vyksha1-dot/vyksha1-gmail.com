import React from 'react';
import { motion } from 'motion/react';

export const Logo = ({ className = "w-12 h-12" }: { className?: string }) => {
  return (
    <div className={`relative ${className} group`}>
      {/* Background shadow/offset block */}
      <div className="absolute inset-0 bg-ink translate-x-1 translate-y-1 transition-transform group-hover:translate-x-1.5 group-hover:translate-y-1.5" />
      
      {/* Main Container */}
      <div className="absolute inset-0 bg-neon border-4 border-ink flex items-center justify-center overflow-hidden">
        {/* Animated Grid lines in background */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="w-full h-full grid grid-cols-4 grid-rows-4">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className="border-[0.5px] border-ink" />
            ))}
          </div>
        </div>

        {/* Brand Mark: stylized 'X' inside a square representing the 'fixed' pothole */}
        <motion.div
          initial={{ scale: 0.8, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          whileHover={{ scale: 1.1, rotate: 5 }}
          className="relative z-10 w-2/3 h-2/3"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[2px_2px_0px_#000]">
            <rect x="10" y="10" width="80" height="80" fill="none" stroke="black" strokeWidth="12" />
            <motion.path
              d="M25 25 L75 75 M75 25 L25 75"
              fill="none"
              stroke="black"
              strokeWidth="12"
              strokeLinecap="square"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
            />
          </svg>
        </motion.div>
      </div>
      
      {/* Status Dot */}
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-paper border-2 border-ink rounded-full z-20">
        <div className="w-full h-full rounded-full bg-ink animate-pulse" />
      </div>
    </div>
  );
};
