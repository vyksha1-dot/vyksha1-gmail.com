/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  auth, db, OperationType, handleFirestoreError 
} from './firebase';
import { 
  signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User 
} from 'firebase/auth';
import { 
  collection, doc, setDoc, getDoc, onSnapshot, query, orderBy, updateDoc, deleteDoc, serverTimestamp, getDocFromServer
} from 'firebase/firestore';
import { 
  Camera, MapPin, AlertTriangle, CheckCircle, Clock, LogOut, User as UserIcon, 
  Map as MapIcon, Plus, X, ChevronRight, Info, CreditCard, Trash2
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl } from 'react-leaflet';
import { QRCodeSVG } from 'qrcode.react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { PotholeReport, UserProfile } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// Fix Leaflet icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const STATUS_COLORS = {
  pending: 'bg-yellow-400 text-ink border-ink',
  'in-progress': 'bg-blue-400 text-ink border-ink',
  repaired: 'bg-green-400 text-ink border-ink',
};

const SEVERITY_COLORS = {
  low: 'bg-muted text-ink border-ink',
  medium: 'bg-orange-400 text-ink border-ink',
  high: 'bg-red-500 text-paper border-ink',
};

function isAfterHours() {
  const hour = new Date().getHours();
  return hour >= 17 || hour < 6;
}

function getPrice(severity: 'low' | 'medium' | 'high') {
  const afterHours = isAfterHours();
  const pricing = {
    standard: { low: 299, medium: 499, high: 0 },
    afterHours: { low: 598, medium: 998, high: 0 }
  };

  const set = afterHours ? pricing.afterHours : pricing.standard;
  return set[severity];
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

function CountdownTimer({ createdAt, status }: { createdAt: number, status: string }) {
  const [timeLeft, setTimeLeft] = React.useState<number>(0);

  React.useEffect(() => {
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

function LandingPage({ onLogin, isLoading }: { onLogin: () => void, isLoading: boolean }) {
  return (
    <div className="min-h-screen bg-paper text-ink overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-[200] border-b-4 border-ink bg-paper/80 backdrop-blur-md px-12 py-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-neon p-2 border-2 border-ink">
            <Clock className="w-6 h-6" />
          </div>
          <span className="font-black text-2xl uppercase tracking-tighter">1HR REPAIR</span>
        </div>
        <div className="flex gap-8 items-center">
          <button 
            onClick={onLogin} 
            disabled={isLoading}
            className="text-xs font-black uppercase tracking-widest hover:text-neon transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Wait...' : 'Client Portal'}
          </button>
          <button 
            onClick={onLogin} 
            disabled={isLoading}
            className="px-6 py-2 bg-neon border-4 border-ink bold-shadow font-black uppercase text-xs tracking-widest hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading && <div className="w-3 h-3 border-2 border-ink/30 border-t-ink rounded-full animate-spin" />}
            {isLoading ? 'Loading...' : 'Report Now'}
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
            1 Hour<br />
            <span className="text-neon bg-ink pr-8">Repair.</span><br />
            Period.
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
                onClick={onLogin}
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
            <h2 className="text-5xl font-black tracking-tighter uppercase">1HOURPOTHOLE.COM</h2>
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
              <a href="#" className="hover:text-neon">Repair@1hourpothole.com</a>
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reports, setReports] = useState<PotholeReport[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState<'map' | 'list' | 'report' | 'admin'>('map');
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<PotholeReport | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Report Form State
  const [isReporting, setIsReporting] = useState(false);
  const [reportImage, setReportImage] = useState<string | null>(null);
  const [reportLocation, setReportLocation] = useState<{lat: number, lng: number} | null>(null);
  const [reportAddress, setReportAddress] = useState('');
  const [reportSeverity, setReportSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [reportDescription, setReportDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
        }
      }
    }
    testConnection();
  }, []);

  useEffect(() => {
    // Handle Stripe Success Callback
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    const reportId = params.get('reportId');

    if (payment === 'success' && reportId) {
      const updateReport = async () => {
        try {
          await updateDoc(doc(db, 'reports', reportId), { 
            paymentStatus: 'paid' 
          });
          // Clear query params to prevent re-triggering
          window.history.replaceState({}, '', '/');
        } catch (error) {
          console.error("Error updating payment status:", error);
        }
      };
      updateReport();
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch or create profile
        const profileRef = doc(db, 'users', u.uid);
        try {
          const profileSnap = await getDoc(profileRef);
          if (profileSnap.exists()) {
            setProfile(profileSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || 'Anonymous',
              role: 'customer',
              createdAt: Date.now(),
            };
            await setDoc(profileRef, newProfile);
            setProfile(newProfile);
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      } else {
        setProfile(null);
      }
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setReports([]);
      return;
    }

    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PotholeReport));
      setReports(reportsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reports');
    });

    return unsubscribe;
  }, [isAuthReady, user]);

  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      // Ignore user-initiated cancellation errors
      if (error.code !== 'auth/cancelled-popup-request' && error.code !== 'auth/popup-closed-by-user') {
        console.error("Login failed:", error);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => auth.signOut();

  const handlePayment = async (report: PotholeReport) => {
    if (!user || isPaying) return;
    setIsPaying(true);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId: report.id,
          price: report.price,
          userEmail: user.email,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        let serverError = "Server check failed";
        try {
          const parsed = JSON.parse(text);
          serverError = parsed.error || serverError;
        } catch (e) {
          if (response.status === 404) {
            serverError = "API not found. Ensure you exported the latest code with vercel.json.";
          }
        }
        throw new Error(serverError);
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("No checkout URL received from server");
      }
    } catch (error: any) {
      console.error("Payment failed:", error);
      alert(`Payment Error: ${error.message || "Failed to initiate checkout"}`);
    } finally {
      setIsPaying(false);
    }
  };

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReportImage(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Get location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setReportLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          (err) => console.error("Geolocation error:", err)
        );
      }
    }
  };

  const submitReport = async () => {
    if (!user || !reportImage || (!reportLocation && !reportAddress)) return;
    setIsReporting(true);
    
    const reportId = crypto.randomUUID();
    const finalPrice = getPrice(reportSeverity);

    const newReport: PotholeReport = {
      id: reportId,
      userId: user.uid,
      userEmail: user.email || '',
      imageUrl: reportImage,
      location: {
        latitude: reportLocation?.lat || (reportAddress ? 38.2527 : 0),
        longitude: reportLocation?.lng || (reportAddress ? -85.7585 : 0),
        address: reportAddress || undefined,
      },
      status: 'pending',
      paymentStatus: 'unpaid',
      price: finalPrice,
      severity: reportSeverity,
      description: reportDescription,
      createdAt: Date.now(),
    };

    try {
      await setDoc(doc(db, 'reports', reportId), newReport);
      setShowReportModal(false);
      setReportImage(null);
      setReportLocation(null);
      setReportAddress('');
      setReportDescription('');
      setReportSeverity('medium');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reports');
    } finally {
      setIsReporting(false);
    }
  };

  const updateStatus = async (reportId: string, newStatus: PotholeReport['status']) => {
    if (profile?.role !== 'technician' && profile?.role !== 'admin') return;
    
    try {
      await updateDoc(doc(db, 'reports', reportId), { status: newStatus });
      setSelectedReport(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  const updatePaymentStatus = async (reportId: string, newStatus: PotholeReport['paymentStatus']) => {
    if (profile?.role !== 'admin') return;
    
    try {
      await updateDoc(doc(db, 'reports', reportId), { paymentStatus: newStatus });
      setSelectedReport(prev => prev ? { ...prev, paymentStatus: newStatus } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  const deleteReport = async (reportId: string) => {
    if (profile?.role !== 'admin') return;
    
    if (!window.confirm("Are you sure you want to PERMANENTLY delete this repair ticket? This cannot be undone.")) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setSelectedReport(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reports/${reportId}`);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onLogin={handleLogin} isLoading={isLoggingIn} />;
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-paper flex h-screen overflow-hidden">
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {/* Header */}
          <header className="p-12 pb-6">
            <h1 className="text-[120px] leading-[0.85] font-black tracking-[-6px] uppercase">
              1 HOUR<br />REPAIR
            </h1>
          </header>

          {/* View Toggle & Content */}
          <div className="flex-1 flex flex-col px-12 pb-12 overflow-hidden">
            <div className="flex items-center gap-4 mb-6">
              <button 
                onClick={() => setView('map')}
                className={cn(
                  "px-6 py-2 font-black uppercase tracking-tighter border-4 border-ink transition-all",
                  view === 'map' ? "bg-neon bold-shadow" : "bg-paper hover:bg-muted"
                )}
              >
                Map
              </button>
              <button 
                onClick={() => setView('list')}
                className={cn(
                  "px-6 py-2 font-black uppercase tracking-tighter border-4 border-ink transition-all",
                  view === 'list' ? "bg-neon bold-shadow" : "bg-paper hover:bg-muted"
                )}
              >
                List
              </button>
              {(profile?.role === 'city-worker' || profile?.role === 'admin') && (
                <button 
                  onClick={() => setView('admin')}
                  className={cn(
                    "px-6 py-2 font-black uppercase tracking-tighter border-4 border-ink transition-all",
                    view === 'admin' ? "bg-neon bold-shadow" : "bg-paper hover:bg-muted"
                  )}
                >
                  Admin
                </button>
              )}
              <div className="ml-auto flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs font-black uppercase">{user.displayName}</p>
                  <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest">
                    {profile?.role === 'customer' ? 'Customer' : profile?.role === 'technician' ? 'Technician' : 'Admin'}
                  </p>
                </div>
                <button onClick={handleLogout} className="p-2 hover:text-red-600 transition-colors">
                  <LogOut className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="flex-1 relative bold-border bg-muted overflow-hidden">
              {view === 'map' && (
                <div className="h-full w-full z-0">
                  <MapContainer 
                    center={[38.2527, -85.7585]} 
                    zoom={12} 
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                  >
                    <LayersControl position="topright">
                      <LayersControl.BaseLayer checked name="Standard">
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />
                      </LayersControl.BaseLayer>
                      <LayersControl.BaseLayer name="Satellite">
                        <TileLayer
                          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EBP, and the GIS User Community'
                        />
                      </LayersControl.BaseLayer>
                      <LayersControl.BaseLayer name="Terrain">
                        <TileLayer
                          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
                          attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
                        />
                      </LayersControl.BaseLayer>
                    </LayersControl>
                    {reports.filter(r => r.location.latitude !== 0 && r.location.longitude !== 0).map(report => (
                      <Marker 
                        key={report.id} 
                        position={[report.location.latitude, report.location.longitude]}
                        eventHandlers={{
                          click: () => setSelectedReport(report),
                        }}
                      >
                        <Popup>
                          <div className="p-1 font-sans w-48">
                            <img src={report.imageUrl} alt="Pothole" className="w-full h-24 object-cover border-2 border-ink mb-2" />
                            <div className="flex justify-between items-center mb-2">
                              <p className="font-black text-xs uppercase">{report.status}</p>
                              <p className="font-black text-sm tracking-tighter">${report.price || 'TBD'}</p>
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReport(report);
                                setShowQR(true);
                              }}
                              className="w-full py-2 bg-neon border-2 border-ink text-[10px] font-black uppercase tracking-widest hover:bg-ink hover:text-paper transition-all"
                            >
                              View QR Ticket
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                  {/* Map Grid Overlay Effect */}
                  <div className="absolute inset-0 pointer-events-none opacity-5 grid grid-cols-12 grid-rows-12">
                    {Array.from({ length: 144 }).map((_, i) => (
                      <div key={i} className="border-[0.5px] border-ink" />
                    ))}
                  </div>
                </div>
              )}

              {view === 'list' && (
                <div className="h-full overflow-y-auto p-6 space-y-4 bg-paper">
                  {reports.length === 0 ? (
                    <div className="text-center py-20">
                      <Info className="w-12 h-12 text-muted mx-auto mb-4" />
                      <p className="font-bold uppercase opacity-50">No reports yet.</p>
                    </div>
                  ) : (
                    reports.map(report => (
                      <div 
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className="bg-paper p-4 border-2 border-ink flex items-center gap-6 cursor-pointer hover:bg-muted transition-all"
                      >
                        <img src={report.imageUrl} className="w-24 h-24 border-2 border-ink object-cover flex-shrink-0" alt="Pothole" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-0.5 bg-ink text-paper text-[9px] font-black uppercase tracking-widest">
                              {report.status}
                            </span>
                            <CountdownTimer createdAt={report.createdAt} status={report.status} />
                            <span className={cn(
                              "px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border border-ink",
                              report.severity === 'high' ? "bg-red-500 text-white" : "bg-paper"
                            )}>
                              {report.severity}
                            </span>
                            <span className={cn(
                              "px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border border-ink",
                              report.paymentStatus === 'paid' ? "bg-green-400" : "bg-yellow-400"
                            )}>
                              {report.paymentStatus}
                            </span>
                          </div>
                          <p className="text-xl font-black uppercase truncate">
                            {report.description || "No description provided"}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-[10px] font-bold opacity-50 uppercase">
                              Reported {new Date(report.createdAt).toLocaleString()}
                            </p>
                            <p className="text-lg font-black uppercase tracking-tighter flex items-center gap-2">
                              <span className="text-[10px] opacity-40">Ticket Ready</span>
                              <Plus className="w-4 h-4 text-neon stroke-[4]" />
                              ${report.price}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-6 h-6" />
                      </div>
                    ))
                  )}
                </div>
              )}

              {view === 'admin' && (
                <div className="h-full overflow-y-auto p-8 bg-paper">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
                    <div className="border-4 border-ink p-6 bold-shadow bg-neon">
                      <h4 className="text-xs font-black uppercase mb-2">Total Revenue</h4>
                      <p className="text-5xl font-black">${reports.filter(r => r.paymentStatus === 'paid').reduce((acc, r) => acc + r.price, 0)}</p>
                    </div>
                    <div className="border-4 border-ink p-6 bold-shadow bg-paper">
                      <h4 className="text-xs font-black uppercase mb-2">Pending Payments</h4>
                      <p className="text-5xl font-black text-red-600">${reports.filter(r => r.paymentStatus === 'unpaid').reduce((acc, r) => acc + r.price, 0)}</p>
                    </div>
                    <div className="border-4 border-ink p-6 bold-shadow bg-paper">
                      <h4 className="text-xs font-black uppercase mb-2">Total Jobs</h4>
                      <p className="text-5xl font-black">{reports.length}</p>
                    </div>
                    <div className="border-4 border-ink p-6 bold-shadow bg-paper">
                      <h4 className="text-xs font-black uppercase mb-2">Completed</h4>
                      <p className="text-5xl font-black">{reports.filter(r => r.status === 'repaired').length}</p>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <h3 className="text-2xl font-black uppercase tracking-tighter">System Monitoring</h3>
                    <div className="border-4 border-ink overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-ink text-paper uppercase text-[10px] font-black tracking-widest">
                            <th className="p-4 border-r border-paper/20">ID</th>
                            <th className="p-4 border-r border-paper/20">Status</th>
                            <th className="p-4 border-r border-paper/20">Payment</th>
                            <th className="p-4 border-r border-paper/20">Price</th>
                            <th className="p-4 border-r border-paper/20">Reporter</th>
                            <th className="p-4">Date</th>
                          </tr>
                        </thead>
                        <tbody className="font-bold text-xs uppercase">
                          {reports.map(report => (
                            <tr key={report.id} className="border-b-2 border-ink hover:bg-muted cursor-pointer" onClick={() => setSelectedReport(report)}>
                              <td className="p-4 border-r-2 border-ink font-mono">{report.id.slice(0, 8)}...</td>
                              <td className="p-4 border-r-2 border-ink">
                                <span className={cn("px-2 py-0.5 text-[9px] font-black", STATUS_COLORS[report.status])}>
                                  {report.status}
                                </span>
                              </td>
                              <td className="p-4 border-r-2 border-ink">
                                <span className={cn(
                                  "px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border border-ink",
                                  report.paymentStatus === 'paid' ? "bg-green-400" : "bg-yellow-400"
                                )}>
                                  {report.paymentStatus}
                                </span>
                              </td>
                              <td className="p-4 border-r-2 border-ink font-black">${report.price}</td>
                              <td className="p-4 border-r-2 border-ink truncate max-w-[150px]">{report.userEmail}</td>
                              <td className="p-4">{new Date(report.createdAt).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Floating Action Button */}
          <button 
            onClick={() => setShowReportModal(true)}
            className="absolute bottom-12 right-12 w-20 h-20 bg-neon text-ink border-4 border-ink bold-shadow flex items-center justify-center hover:scale-105 transition-transform z-40"
          >
            <Plus className="w-10 h-10" />
          </button>
        </main>

        {/* Side Panel */}
        <aside className="w-[380px] border-l-4 border-ink p-12 flex flex-col bg-paper flex-shrink-0 hidden lg:flex">
          <div className="mb-12 space-y-4">
            <div className="border-b-2 border-ink py-4 flex justify-between items-end">
              <div className="text-xs font-bold uppercase opacity-50 pb-1">Active Reports</div>
              <div className="text-5xl font-black leading-none">{reports.filter(r => r.status !== 'repaired').length}</div>
            </div>
            <div className="border-b-2 border-ink py-4 flex justify-between items-end">
              <div className="text-xs font-bold uppercase opacity-50 pb-1">Fixed Today</div>
              <div className="text-5xl font-black leading-none">
                {reports.filter(r => r.status === 'repaired' && new Date(r.createdAt).toDateString() === new Date().toDateString()).length}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            <h3 className="text-sm font-black uppercase tracking-widest mb-6">Recent Activity</h3>
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              {reports.slice(0, 5).map(report => (
                <div key={report.id} className="pb-6 border-b border-muted">
                  <div className="text-[10px] font-black uppercase text-slate-400 mb-1 flex justify-between items-center">
                    <span>{new Date(report.createdAt).toLocaleTimeString()} • {report.severity} Priority</span>
                    <CountdownTimer createdAt={report.createdAt} status={report.status} />
                  </div>
                  <div className="font-bold text-lg leading-tight uppercase mb-2">
                    {report.description || "New pothole reported"}
                  </div>
                  <div className="inline-block px-2 py-0.5 bg-ink text-paper text-[9px] font-black uppercase tracking-widest">
                    {report.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Report Modal */}
        <AnimatePresence>
          {showReportModal && (
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowReportModal(false)}
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
                  <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-ink hover:text-paper transition-colors border-2 border-ink">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="bg-ink text-neon text-[10px] font-black uppercase tracking-[0.2em] py-2 text-center animate-pulse">
                  ⚡ 60-Minute Rapid Response Target ⚡
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto">
                  {/* Image Upload */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "aspect-video border-4 flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative",
                      reportImage ? "border-ink" : "border-muted hover:border-ink bg-muted"
                    )}
                  >
                    {reportImage ? (
                      <>
                        <img src={reportImage} className="w-full h-full object-cover" alt="Preview" />
                        <div className="absolute inset-0 bg-ink/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Camera className="text-paper w-10 h-10" />
                        </div>
                      </>
                    ) : (
                      <>
                        <Camera className="text-ink w-12 h-12 mb-2" />
                        <p className="font-black uppercase text-sm">Take a photo</p>
                      </>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleCapture}
                    />
                  </div>

                  {/* Location Status & Manual Input */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-muted border-2 border-ink">
                      <div className={cn("p-2 border-2 border-ink transition-colors", reportLocation ? "bg-neon" : "bg-paper")}>
                        <MapPin className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-black uppercase">
                          {reportLocation ? "GPS Tagged" : "GPS Signal Waiting..."}
                        </p>
                        <p className="text-[10px] font-bold opacity-50 uppercase">
                          {reportLocation ? `${reportLocation.lat.toFixed(4)}, ${reportLocation.lng.toFixed(4)}` : "Maps offline? Enter address manually below"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Manual Address / Location Detail</label>
                      <input 
                        type="text"
                        value={reportAddress}
                        onChange={(e) => setReportAddress(e.target.value)}
                        placeholder="ENTER NEAREST CROSS STREET OR ADDRESS..."
                        className="w-full p-4 bg-muted border-4 border-ink focus:bg-paper outline-none font-bold uppercase text-sm"
                      />
                    </div>
                  </div>

                  {/* Severity */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Severity</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['low', 'medium', 'high'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setReportSeverity(s)}
                          className={cn(
                            "py-3 font-black uppercase text-xs border-4 transition-all",
                            reportSeverity === s 
                              ? "bg-neon border-ink bold-shadow -translate-x-1 -translate-y-1" 
                              : "bg-paper border-muted text-ink hover:border-ink"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest mb-2 block">Description (Optional)</label>
                    <textarea 
                      value={reportDescription}
                      onChange={(e) => setReportDescription(e.target.value)}
                      placeholder="ADD DETAILS..."
                      className="w-full p-4 bg-muted border-4 border-ink focus:bg-paper outline-none font-bold uppercase text-sm min-h-[100px]"
                    />
                  </div>
                </div>

                <div className="p-6 bg-muted border-t-4 border-ink space-y-4">
                  <div className="bg-paper p-3 border-2 border-ink flex items-center gap-3 mb-2">
                    <Clock className="w-5 h-5 text-neon fill-ink" />
                    <div>
                      <p className="text-[9px] font-black uppercase leading-tight">60-Min Target</p>
                      <p className="text-[11px] font-bold uppercase leading-tight opacity-60">Repaired in 1 hr targeting goal*</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-2">
                    <span className="text-xs font-black uppercase opacity-50">Total Price</span>
                    <span className="text-3xl font-black uppercase tracking-tighter">
                      {reportSeverity === 'high' ? "AFTER INSPECTION" : `$${getPrice(reportSeverity)}`}
                    </span>
                  </div>
                  <button
                    disabled={!reportImage || (!reportLocation && !reportAddress) || isReporting}
                    onClick={submitReport}
                    className="w-full py-4 bg-neon text-ink border-4 border-ink font-black uppercase tracking-tighter text-xl bold-shadow disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
                  >
                    {isReporting ? (
                      <div className="w-6 h-6 border-4 border-ink/30 border-t-ink rounded-full animate-spin" />
                    ) : (
                      <>CONFIRM 1-HOUR REPAIR</>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Detail Modal */}
        <AnimatePresence>
          {selectedReport && (
            <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setSelectedReport(null);
                  setShowQR(false);
                }}
                className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                className="relative bg-white w-full max-w-lg border-4 border-ink overflow-hidden bold-shadow flex flex-col max-h-[90vh]"
              >
                <div className="relative h-72 border-b-4 border-ink">
                  <img src={selectedReport.imageUrl} className="w-full h-full object-cover" alt="Pothole" />
                  <button 
                    onClick={() => {
                      setSelectedReport(null);
                      setShowQR(false);
                    }}
                    className="absolute top-4 right-4 p-2 bg-neon border-2 border-ink text-ink hover:bg-ink hover:text-paper transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                  <div className="p-8 space-y-8 overflow-y-auto">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="px-3 py-1 bg-ink text-paper text-[10px] font-black uppercase tracking-widest">
                          {selectedReport.status}
                        </span>
                        <CountdownTimer createdAt={selectedReport.createdAt} status={selectedReport.status} />
                        <span className={cn(
                          "px-3 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-ink",
                          selectedReport.severity === 'high' ? "bg-red-500 text-white" : "bg-paper"
                        )}>
                          {selectedReport.severity}
                        </span>
                        <span className={cn(
                          "px-3 py-1 text-[10px] font-black uppercase tracking-widest border-2 border-ink",
                          selectedReport.paymentStatus === 'paid' ? "bg-green-400" : "bg-yellow-400"
                        )}>
                          {selectedReport.paymentStatus}
                        </span>
                      </div>
                      <p className="text-[10px] font-black uppercase opacity-50">{new Date(selectedReport.createdAt).toLocaleString()}</p>
                    </div>

                    <div className="flex items-center justify-between border-y-4 border-ink py-4">
                      <h4 className="text-sm font-black uppercase tracking-widest">Service Price</h4>
                      <p className="text-4xl font-black tracking-tighter">
                        ${selectedReport.price}
                      </p>
                    </div>

                    <div className="flex flex-col items-center text-center space-y-4 p-6 bg-paper border-4 border-ink bold-shadow">
                      <QRCodeSVG 
                        value={JSON.stringify({
                          id: selectedReport.id,
                          price: selectedReport.price,
                          location: selectedReport.location,
                          status: selectedReport.status,
                          agreement: "By scanning this, the customer agrees to the 1-hour professional pavement repair service. All work is targeted within 60 minutes subject to weather and traffic conditions. Service is warranted for 12 months."
                        })}
                        size={160}
                        level="H"
                      />
                      <div className="space-y-1">
                        <h4 className="text-lg font-black uppercase tracking-tighter">Service Ticket (QR)</h4>
                        <p className="text-[9px] font-bold opacity-50 uppercase max-w-xs mx-auto">
                          Scan to verify job details & agreement
                        </p>
                      </div>
                      <div className="p-3 bg-muted border-2 border-ink text-left w-full">
                        <h5 className="text-[9px] font-black uppercase mb-1">Service Agreement</h5>
                        <p className="text-[8px] font-bold leading-tight opacity-70 uppercase">
                          • Professional pothole filling & sealing<br/>
                          • Fixed price: ${selectedReport.price}<br/>
                          • 12-month warranty included
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-50">Description</h4>
                      <p className="text-2xl font-black uppercase leading-tight">{selectedReport.description || "No description provided."}</p>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-muted border-2 border-ink">
                      <MapPin className="text-ink w-8 h-8" />
                      <div>
                        <p className="text-xs font-black uppercase">{selectedReport.location.address ? "Reported Address" : "Coordinates"}</p>
                        <p className="text-[10px] font-bold opacity-50">
                          {selectedReport.location.address || `${selectedReport.location.latitude.toFixed(6)}, ${selectedReport.location.longitude.toFixed(6)}`}
                        </p>
                      </div>
                    </div>

                    {/* Customer Payment Action */}
                    {profile?.role === 'customer' && selectedReport.paymentStatus === 'unpaid' && (
                      <div className="pt-4">
                        {selectedReport.price === 0 ? (
                          <div className="bg-yellow-400 border-4 border-ink p-6 space-y-2 bold-shadow">
                            <h4 className="text-xl font-black uppercase tracking-tighter">Inspection Required</h4>
                            <p className="text-[10px] font-bold uppercase leading-tight opacity-70">
                              This repair requires a structural assessment by our lead technician. 
                              Pricing for Danger Zone issues and foundation repair is provided on-site.
                            </p>
                          </div>
                        ) : (
                          <button
                            onClick={() => handlePayment(selectedReport)}
                            disabled={isPaying}
                            className="w-full bold-button bg-neon flex items-center justify-center gap-3 h-20"
                          >
                            {isPaying ? (
                              <div className="w-8 h-8 border-4 border-ink/30 border-t-ink rounded-full animate-spin" />
                            ) : (
                              <>
                                <CreditCard className="w-8 h-8" />
                                <div className="text-left">
                                  <div className="text-[10px] font-black leading-none opacity-60">SECURE PAYMENT</div>
                                  <div className="text-2xl font-black leading-none">PAY ${selectedReport.price} NOW</div>
                                </div>
                              </>
                            )}
                          </button>
                        )}
                        {selectedReport.price > 0 && (
                          <p className="text-[9px] font-bold uppercase opacity-40 text-center mt-3 tracking-widest leading-tight">
                            Secure processing by Stripe • Instant status update<br/>
                            Repair commitment finalized after payment
                          </p>
                        )}
                      </div>
                    )}

                    {selectedReport.paymentStatus === 'paid' && (
                      <div className="bg-green-400 border-4 border-ink p-6 flex flex-col items-center justify-center text-center space-y-2 bold-shadow">
                        <CheckCircle className="w-12 h-12 text-ink" />
                        <h4 className="text-2xl font-black uppercase tracking-tighter">Repair Paid</h4>
                        <p className="text-xs font-bold uppercase opacity-70">Payment confirmed & service locked in</p>
                      </div>
                    )}

                    {/* Admin/Worker Controls */}
                    {(profile?.role === 'technician' || profile?.role === 'admin') && (
                      <div className="pt-6 border-t-2 border-ink space-y-6">
                        <div>
                          <label className="text-[10px] font-black uppercase tracking-widest mb-4 block opacity-50">Job Status</label>
                          <div className="grid grid-cols-1 gap-2">
                            {(['pending', 'in-progress', 'repaired'] as const).map(s => (
                              <button
                                key={s}
                                onClick={() => updateStatus(selectedReport.id, s)}
                                className={cn(
                                  "px-6 py-3 font-black uppercase tracking-tighter text-sm transition-all border-4",
                                  selectedReport.status === s 
                                    ? "bg-neon border-ink bold-shadow" 
                                    : "bg-paper border-muted text-ink hover:border-ink"
                                )}
                              >
                                {s === 'pending' ? 'Pending' : s === 'in-progress' ? 'In Progress' : 'Mark Completed'}
                              </button>
                            ))}
                          </div>
                        </div>

                        {profile?.role === 'admin' && (
                          <div>
                            <label className="text-[10px] font-black uppercase tracking-widest mb-4 block opacity-50">Payment Status</label>
                            <div className="grid grid-cols-2 gap-2">
                              {(['unpaid', 'paid'] as const).map(s => (
                                <button
                                  key={s}
                                  onClick={() => updatePaymentStatus(selectedReport.id, s)}
                                  className={cn(
                                    "px-6 py-3 font-black uppercase tracking-tighter text-sm transition-all border-4",
                                    selectedReport.paymentStatus === s 
                                      ? "bg-neon border-ink bold-shadow" 
                                      : "bg-paper border-muted text-ink hover:border-ink"
                                  )}
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {profile?.role === 'admin' && (
                          <div className="pt-6 border-t-2 border-ink border-dashed">
                            <label className="text-[10px] font-black uppercase tracking-widest mb-4 block text-red-600 uppercase">Danger Zone</label>
                            <button
                              onClick={() => deleteReport(selectedReport.id)}
                              className="w-full px-4 py-3 font-black uppercase tracking-tighter border-4 border-ink bg-paper text-red-600 hover:bg-red-100 transition-all flex items-center justify-center gap-2 bold-shadow active:translate-y-1"
                            >
                              <Trash2 className="w-6 h-6" />
                              Delete This Work
                            </button>
                            <p className="text-[8px] font-bold text-red-600/70 uppercase text-center mt-3">
                              Warning: This action is permanent and cannot be undone.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
