import React from 'react';
import { motion } from 'motion/react';

export const Logo = ({ className = "w-12 h-12" }: { className?: string }) => {
  return (
    <div className={`${className} flex items-center justify-center p-2`}>
      {/* Brand Image Logo */}
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        className="relative z-10 w-full h-full"
      >
        <img 
          src={`https://lh3.googleusercontent.com/d/1EXYFc8my-l1o7TBom7Ts7_xkz8Cwtlp_`} 
          alt="Quick Pothole Fix Logo" 
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            if (!target.dataset.triedBackup) {
              target.dataset.triedBackup = 'true';
              target.src = "https://drive.google.com/uc?id=1EXYFc8my-l1o7TBom7Ts7_xkz8Cwtlp_&export=download";
            } else {
              target.src = "/logo.png";
            }
          }}
        />
      </motion.div>
    </div>
  );
};
