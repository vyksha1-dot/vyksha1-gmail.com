import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export function CountdownTimer({ createdAt, status }: { createdAt: number, status: string }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (status === 'repaired') return;

    const calculateTimeLeft = () => {
      const now = Date.now();
      const difference = (createdAt + 3600000) - now;
      setTimeLeft(Math.max(0, difference));
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [createdAt, status]);

  if (status === 'repaired') {
    return (
      <span className="px-2 py-0.5 bg-green-400 text-ink text-[9px] font-black border border-ink flex items-center gap-1">
        <CheckCircle className="w-2.5 h-2.5" />
        REPAIRED
      </span>
    );
  }

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  if (timeLeft === 0) {
    return (
      <div className="flex flex-col gap-1 items-start">
        <span className="px-2 py-0.5 bg-red-600 text-paper text-[9px] font-black border border-ink flex items-center gap-1 animate-pulse">
          <AlertTriangle className="w-2.5 h-2.5" />
          SERVICE TARGET EXCEEDED
        </span>
        <span className="text-[7px] font-bold uppercase opacity-50 px-1">Weather & traffic permitting</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 items-start">
      <span className={cn(
        "px-2 py-0.5 text-ink text-[9px] font-black border border-ink flex items-center gap-1",
        minutes < 10 ? "bg-orange-500 animate-pulse" : "bg-neon"
      )}>
        <Clock className="w-2.5 h-2.5" />
        {minutes}:{seconds.toString().padStart(2, '0')} TARGET
      </span>
    </div>
  );
}
