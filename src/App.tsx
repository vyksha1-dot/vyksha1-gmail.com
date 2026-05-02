/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { Logo } from './components/Logo';
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
  Map as MapIcon, Plus, X, ChevronRight, Info, CreditCard, Trash2,
  Zap, ShieldAlert, Globe, Download, Maximize, Maximize2, ArrowDown,
  MessageSquare, Check, DollarSign
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { MapContainer, TileLayer, Marker, Popup, useMap, LayersControl } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { QRCodeSVG } from 'qrcode.react';
import { GoogleGenAI, Type } from "@google/genai";
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { PotholeReport, UserProfile } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingPage } from './components/LandingPage';
import { ReportModal } from './components/ReportModal';
import { CountdownTimer } from './components/CountdownTimer';
import { isAfterHours, getPrice } from './lib/pricing';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

// Fix Leaflet icon issue
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const gModel = "gemini-3-flash-preview";

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

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
}

const createCustomClusterIcon = (cluster: any) => {
  return L.divIcon({
    html: `<span>${cluster.getChildCount()}</span>`,
    className: 'marker-cluster-custom',
    iconSize: L.point(40, 40, true),
  });
};

function ReportDetailContent({ 
  report, 
  isAdmin, 
  onClose, 
  onUpdatePayment, 
  onDelete, 
  smsMessage, 
  setSmsMessage, 
  isSendingSMS, 
  onSendSMS, 
  onUpdateStatus,
  onRequestPayment,
  isRequestingPayment,
  onVerifyPhoto,
  onUpdatePrice
}: any) {
  const [activeTab, setActiveTab] = useState<'details' | 'location' | 'photos' | 'analysis' | 'admin'>('details');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState(false);
  const [manualPrice, setManualPrice] = useState(report.price.toString());
  const [isUpdatingPrice, setIsUpdatingPrice] = useState(false);
  const [justUpdatedPrice, setJustUpdatedPrice] = useState(false);

  useEffect(() => {
    setManualPrice(report.price.toString());
  }, [report.id, report.price]);

  const tabs = [
    { id: 'details', label: 'Details', icon: Info },
    { id: 'location', label: 'Location', icon: MapPin },
    { id: 'photos', label: 'Photos', icon: Camera },
    { id: 'analysis', label: 'AI', icon: Zap },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: ShieldAlert }] : [])
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-paper">
      {/* Header with Close */}
      <div className="p-4 md:p-6 border-b-4 border-ink flex items-center justify-between bg-paper z-10">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-3 h-3 rounded-full animate-pulse",
            report.status === 'repaired' ? "bg-green-500" : "bg-neon"
          )} />
          <h3 className="text-sm font-black uppercase tracking-widest">
            Ticket #{report.id.slice(0, 8)}
          </h3>
        </div>
        <button 
          onClick={onClose}
          className="p-3 md:p-2 border-2 border-ink hover:bg-ink hover:text-paper transition-all bold-shadow active:translate-y-1 touch-manipulation"
        >
          <X className="w-6 h-6 md:w-5 md:h-5" />
        </button>
      </div>

      {/* Modern Tabs */}
      <div className="flex border-b-2 border-ink bg-muted overflow-x-auto custom-scrollbar no-scrollbar scroll-smooth">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 min-w-[90px] py-4 px-4 flex flex-col items-center gap-1 transition-all border-r-2 border-ink last:border-r-0 active:bg-ink active:text-paper touch-manipulation",
              activeTab === tab.id 
                ? "bg-neon text-ink" 
                : "bg-paper text-slate-400 hover:bg-muted hover:text-ink"
            )}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-tighter">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="p-6 space-y-6"
          >
            {activeTab === 'details' && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
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
                  <p className="text-[9px] font-black uppercase opacity-50">
                    {new Date(report.createdAt).toLocaleDateString()} {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                </div>

                <div className="flex flex-col border-y-2 border-ink py-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Service Value</h4>
                    <p className="text-3xl font-black tracking-tighter">${report.price}</p>
                  </div>
                  <p className="text-[7px] font-black uppercase text-red-500 mt-1">* NOTE: IT MIGHT BE MORE IF THE ACTUAL POTHOLE IS A DIFFERENT SIZE AND NEEDS MORE MATERIAL TO FIX.</p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-muted border-2 border-ink">
                    <h4 className="text-[9px] font-black uppercase tracking-widest mb-2 opacity-50">Description</h4>
                    <p className="text-lg font-black uppercase leading-tight">{report.description || "No description provided."}</p>
                  </div>

                  <div className="flex flex-col items-center text-center space-y-4 p-4 bg-paper border-2 border-ink bold-shadow">
                    <div className="w-full text-left space-y-3">
                      <h4 className="text-[9px] font-black uppercase tracking-widest border-b border-ink pb-1">Reporter Information</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-[7px] font-black uppercase opacity-50">Client Name</p>
                          <p className="text-xs font-black uppercase truncate">{report.reporterName}</p>
                        </div>
                        <div>
                          <p className="text-[7px] font-black uppercase opacity-50">Auth Phone</p>
                          <p className="text-xs font-black uppercase italic">{report.reporterPhone}</p>
                        </div>
                      </div>
                    </div>
                    <QRCodeSVG value={JSON.stringify({ id: report.id })} size={100} level="H" />
                    <p className="text-[7px] font-black uppercase tracking-widest opacity-40 italic">Scan for onsite crew verification</p>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'location' && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 p-4 bg-muted border-2 border-ink">
                  <MapPin className="text-ink w-8 h-8 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase leading-none mb-1">Dispatch Address</p>
                    <p className="text-sm font-bold uppercase leading-tight">
                      {report.location.address || "Unrecognized Area"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-paper border-2 border-ink">
                    <p className="text-[8px] font-black uppercase opacity-60 mb-1">Latitude</p>
                    <p className="font-mono text-xs">{report.location.latitude.toFixed(6)}</p>
                  </div>
                  <div className="p-3 bg-paper border-2 border-ink">
                    <p className="text-[8px] font-black uppercase opacity-60 mb-1">Longitude</p>
                    <p className="font-mono text-xs">{report.location.longitude.toFixed(6)}</p>
                  </div>
                </div>

                <div className="aspect-square bg-muted border-2 border-ink relative overflow-hidden flex items-center justify-center">
                  <Globe className="w-20 h-20 text-ink opacity-10 animate-spin-slow" />
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-ink text-paper text-center">
                    <p className="text-[9px] font-black uppercase tracking-widest">Awaiting Satalite Feed</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'photos' && (
              <div className="space-y-4">
                <div className="relative group overflow-hidden border-4 border-ink bold-shadow">
                  <img 
                    src={report.imageUrl} 
                    className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-110" 
                    alt="Pothole Damage" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 bg-neon text-ink text-[10px] font-black uppercase tracking-widest border-2 border-ink">Original Capture</span>
                  </div>
                  {report.photoVerification && (
                    <div className="absolute inset-0 bg-ink/40 flex items-center justify-center p-4">
                      {report.photoVerification.status === 'verified' ? (
                        <div className="bg-green-400 border-4 border-ink p-4 flex items-center gap-3 bold-shadow animate-in zoom-in duration-300">
                          <CheckCircle className="w-8 h-8" />
                          <span className="text-xl font-black uppercase italic tracking-tighter">Verified</span>
                        </div>
                      ) : (
                        <div className="bg-red-500 text-paper border-4 border-ink p-4 flex flex-col gap-1 bold-shadow animate-in zoom-in duration-300 w-full max-w-xs">
                          <div className="flex items-center gap-3">
                            <X className="w-8 h-8" />
                            <span className="text-xl font-black uppercase italic tracking-tighter">Rejected</span>
                          </div>
                          {report.photoVerification.reason && (
                            <p className="text-[10px] font-bold uppercase opacity-80 mt-2 border-t border-paper/30 pt-2">
                              Reason: {report.photoVerification.reason}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isAdmin && (!report.photoVerification || report.photoVerification.status === 'pending') && (
                  <div className="bg-muted border-4 border-ink p-4 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4" /> Photo Verification
                    </h4>
                    
                    {!showRejectionInput ? (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => onVerifyPhoto(report.id, 'verified')}
                          className="flex-1 py-4 bg-green-400 border-2 border-ink font-black uppercase text-xs hover:bg-green-500 transition-colors bold-shadow active:translate-y-1"
                        >
                          Confirm Image
                        </button>
                        <button 
                          onClick={() => setShowRejectionInput(true)}
                          className="flex-1 py-4 bg-red-400 border-2 border-ink font-black uppercase text-xs hover:bg-red-500 transition-colors bold-shadow active:translate-y-1"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                        <textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Why is this photo rejected? (e.g. blurry, wrong location, not a pothole)"
                          className="w-full p-3 bg-paper border-2 border-ink font-bold text-[10px] h-20 uppercase resize-none focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              onVerifyPhoto(report.id, 'rejected', rejectionReason);
                              setShowRejectionInput(false);
                            }}
                            disabled={!rejectionReason.trim()}
                            className="flex-1 py-3 bg-red-500 text-paper border-2 border-ink font-black uppercase text-[10px] disabled:opacity-50"
                          >
                            Send Rejection
                          </button>
                          <button 
                            onClick={() => setShowRejectionInput(false)}
                            className="px-4 py-3 bg-muted border-2 border-ink font-black uppercase text-[10px]"
                          >
                            Back
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <button className="flex-1 py-3 border-2 border-ink bg-muted text-[10px] font-black uppercase flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" /> Download
                  </button>
                  <button className="flex-1 py-3 border-2 border-ink bg-muted text-[10px] font-black uppercase flex items-center justify-center gap-2">
                    <Maximize className="w-4 h-4" /> Expand
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'analysis' && (
              <div className="space-y-6">
                {!report.measurements ? (
                  <div className="p-8 text-center border-2 border-dashed border-ink opacity-40">
                    <Zap className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">No AI Metrics Available</p>
                  </div>
                ) : (
                  <>
                    <h4 className="text-xs font-black uppercase tracking-widest border-b-2 border-ink pb-2 text-center">AI Structural Assessment</h4>
                    <div className="grid grid-cols-1 gap-4">
                      {[
                        { label: 'Width', value: report.measurements.widthInches, unit: 'IN', icon: Maximize },
                        { label: 'Length', value: report.measurements.lengthInches, unit: 'IN', icon: Maximize2 },
                        { label: 'Estimated Depth', value: report.measurements.depthInches, unit: 'IN', icon: ArrowDown, critical: true }
                      ].map((m, i) => (
                        <div key={i} className="flex items-center justify-between p-4 bg-muted border-2 border-ink">
                          <div className="flex items-center gap-3">
                            <m.icon className={cn("w-5 h-5", m.critical && "text-red-600 animate-pulse")} />
                            <span className="text-[10px] font-black uppercase">{m.label}</span>
                          </div>
                          <p className={cn("text-2xl font-black", m.critical && "text-red-600")}>
                            {m.value}<span className="text-xs ml-1 font-bold">{m.unit}</span>
                          </p>
                        </div>
                      ))}
                      {report.measurements.size && (
                        <div className="flex items-center justify-between p-4 bg-ink text-paper border-2 border-ink">
                          <div className="flex items-center gap-3">
                            <Zap className="w-5 h-5 text-neon" />
                            <span className="text-[10px] font-black uppercase">Detected Classification</span>
                          </div>
                          <p className="text-2xl font-black uppercase text-neon">{report.measurements.size}</p>
                        </div>
                      )}
                    </div>
                    <div className="p-4 bg-neon/10 border-2 border-neon text-ink">
                      <p className="text-[8px] font-black uppercase tracking-widest mb-1">Crew Recommendation</p>
                      <p className="text-xs font-bold leading-tight uppercase">
                        Requires rapid fill S32 asphalt mix. Estimated volume: 4.2kg.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'admin' && isAdmin && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-center py-2 bg-ink text-paper">Command Center</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    disabled={isRequestingPayment || report.paymentStatus === 'paid'}
                    onClick={() => {
                      if (report.paymentStatus === 'paid') {
                        onUpdatePayment(report.id, 'unpaid');
                      } else {
                        onRequestPayment(report);
                      }
                    }}
                    className={cn(
                      "flex flex-col items-center gap-2 p-4 border-2 border-ink font-black uppercase transition-all bold-shadow active:translate-y-1 touch-manipulation",
                      report.paymentStatus === 'paid' ? "bg-green-400" : "bg-paper hover:bg-neon",
                      isRequestingPayment && "animate-pulse"
                    )}
                  >
                    <CreditCard className="w-5 h-5" />
                    <span className="text-[8px]">
                      {isRequestingPayment ? "Requesting..." : report.paymentStatus === 'paid' ? "Paid (Undo)" : "Request Pay"}
                    </span>
                  </button>
                  
                  <button
                    onClick={() => onDelete(report.id)}
                    className="flex flex-col items-center gap-2 p-4 border-2 border-ink bg-paper text-red-600 font-black uppercase transition-all hover:bg-red-50 bold-shadow active:translate-y-1 touch-manipulation"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="text-[8px]">Terminate</span>
                  </button>
                </div>

                <div className="space-y-2 pt-4 border-t-2 border-ink">
                  <p className="text-[8px] font-black uppercase opacity-50 flex items-center gap-2">
                    <DollarSign className="w-3 h-3" /> Price Override
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-xs">$</span>
                      <input 
                        type="number"
                        value={manualPrice}
                        onChange={(e) => setManualPrice(e.target.value)}
                        className="w-full pl-7 pr-3 py-3 bg-paper border-2 border-ink font-black text-xs focus:outline-none focus:bg-neon/10"
                      />
                    </div>
                    <button 
                      onClick={async () => {
                        const priceValue = parseFloat(manualPrice);
                        if (isNaN(priceValue)) return;
                        
                        setIsUpdatingPrice(true);
                        await onUpdatePrice(report.id, priceValue);
                        setIsUpdatingPrice(false);
                        setJustUpdatedPrice(true);
                        setTimeout(() => setJustUpdatedPrice(false), 2000);
                      }}
                      disabled={isUpdatingPrice || parseFloat(manualPrice) === report.price || isNaN(parseFloat(manualPrice))}
                      className={cn(
                        "px-6 py-3 border-2 border-ink font-black uppercase text-[10px] bold-shadow active:translate-y-1 transition-all disabled:opacity-50",
                        justUpdatedPrice ? "bg-green-400" : "bg-neon"
                      )}
                    >
                      {isUpdatingPrice ? "..." : justUpdatedPrice ? <Check className="w-4 h-4 mx-auto" /> : "Apply"}
                    </button>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t-2 border-ink">
                  <p className="text-[8px] font-black uppercase opacity-50 flex items-center gap-2">
                    <MessageSquare className="w-3 h-3" /> Quick Dispatch SMS
                  </p>
                  <div className="space-y-2">
                    <textarea
                      value={smsMessage}
                      onChange={(e) => setSmsMessage(e.target.value)}
                      placeholder="Dispatcher notes to reporter..."
                      className="w-full p-3 bg-muted border-2 border-ink font-bold text-[10px] h-20 uppercase resize-none"
                    />
                    <button
                      disabled={isSendingSMS || !smsMessage.trim()}
                      onClick={() => onSendSMS(report)}
                      className="w-full py-3 bg-ink text-paper font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transition-transform"
                    >
                      {isSendingSMS ? "Transmitting..." : "Send SMS Transmission"}
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-4">
                  <p className="text-[8px] font-black uppercase opacity-50 text-center">Protocol Status</p>
                  <div className="grid grid-cols-1 gap-1">
                    {(['pending', 'in-progress', 'repaired'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => onUpdateStatus(report.id, s)}
                        className={cn(
                          "py-4 border-2 border-ink font-black uppercase text-[10px] transition-all flex items-center justify-between px-4 touch-manipulation",
                          report.status === s ? "bg-neon" : "bg-muted opacity-50 grayscale hover:grayscale-0 hover:opacity-100"
                        )}
                      >
                        <span>{s.replace('-', ' ')}</span>
                        {report.status === s && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
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
  const [adminTab, setAdminTab] = useState<'reports' | 'users'>('reports');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedReport, setSelectedReport] = useState<PotholeReport | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [showLanding, setShowLanding] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [smsMessageToSend, setSmsMessageToSend] = useState('');
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  const [isRequestingPayment, setIsRequestingPayment] = useState(false);

  const handleRequestPayment = async (report: PotholeReport) => {
    if (isRequestingPayment) return;
    setIsRequestingPayment(true);
    
    try {
      // 1. Create Checkout Session
      const checkoutRes = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          price: report.price,
          userEmail: report.reporterEmail || 'anonymous@pothole.fix',
        }),
      });

      if (!checkoutRes.ok) throw new Error('Checkout creation failed');
      const { url } = await checkoutRes.json();

      // 2. Send SMS with link
      const paymentLinkMsg = `Quick Fix: Your pothole repair is ready for dispatch. Pay here to prioritize: ${url}`;
      
      const smsRes = await fetch('/api/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: report.reporterPhone,
          body: paymentLinkMsg
        }),
      });

      if (!smsRes.ok) {
        alert("Payment link generated internally, but SMS failed. Please copy the link from Stripe dashboard.");
      } else {
        alert("Payment request sent to customer via SMS.");
      }
    } catch (error) {
      console.error("Payment request error:", error);
      alert("Failed to generate payment request. Please try again.");
    } finally {
      setIsRequestingPayment(false);
    }
  };
  
  // Report Form State
  const [isReporting, setIsReporting] = useState(false);
  const [reportName, setReportName] = useState('');
  const [reportPhone, setReportPhone] = useState('');
  const [reportEmail, setReportEmail] = useState('');
  const [isValidatingImage, setIsValidatingImage] = useState(false);
  const [reportImage, setReportImage] = useState<string | null>(null);
  const [reportLocation, setReportLocation] = useState<{lat: number, lng: number} | null>(null);
  const [reportAddress, setReportAddress] = useState('');
  const [reportSeverity, setReportSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [reportDescription, setReportDescription] = useState('');
  const [reportMeasurements, setReportMeasurements] = useState<PotholeReport['measurements'] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await response.json();
      if (data && data.display_name) {
        setReportAddress(data.display_name);
      }
    } catch (error) {
      console.error("Reverse geocoding error:", error);
    }
  };

  const startGeolocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setReportLocation({ lat: latitude, lng: longitude });
        fetchAddress(latitude, longitude);
        setIsLocating(false);
      },
      (err) => {
        console.error("Geolocation error:", err);
        setIsLocating(false);
        if (err.code === 1) alert("LOCATION DENIED: Please enable GPS for rapid dispatch.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleOpenReportModal = () => {
    setShowReportModal(true);
    startGeolocation();
  };

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
          const reportRef = doc(db, 'reports', reportId);
          await updateDoc(reportRef, { 
            paymentStatus: 'paid' 
          });

          // Google Ads Purchase Conversion
          if (typeof window.gtag === 'function') {
            const snap = await getDoc(reportRef);
            if (snap.exists()) {
              const data = snap.data();
              window.gtag('event', 'conversion', {
                'send_to': 'AW-18105279174/DUhNCMmPp6AcEMbForlD',
                'value': data.price,
                'currency': 'USD',
                'transaction_id': reportId
              });
            }
          }

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
    // Always fetch reports (publicly)
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reportsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PotholeReport));
      setReports(reportsData);
    }, (error) => {
      // It's okay if this fail for public users if rules are tightened later
      console.warn("Firestore subscription error:", error.message);
    });

    return unsubscribe;
  }, []);

  const isAdmin = profile?.role === 'admin' || user?.email === 'vik@quickfixpothole.com';

  useEffect(() => {
    if (!isAdmin) {
      setAllUsers([]);
      return;
    }

    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setAllUsers(usersData);
    }, (error) => {
      console.error("User fetch error:", error);
    });

    return unsubscribe;
  }, [isAdmin]);

  const handleUpdateUserRole = async (userId: string, newRole: UserProfile['role']) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

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
    if (isPaying) return;
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
          userEmail: user?.email || report.reporterEmail || 'anonymous@pothole.fix',
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

  const resizeImage = (base64Str: string, maxWidth = 600): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const handleCapture = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsValidatingImage(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        const base64Data = rawBase64.split(',')[1];
        
        try {
          // AI Validation
          const response = await ai.models.generateContent({
            model: gModel,
            contents: {
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: file.type
                  }
                },
                {
                  text: "Analyze this image. Is it a picture of a pothole or road damage? If yes, estimate its measurements in inches (width, length, depth) and classify its size as 'small', 'medium', or 'large'. Small is usually < 12 inches, Medium is 12-24, Large is > 24. Answer in JSON with a boolean 'isPothole', a short 'explanation', 'size' (small/medium/large), and 'measurements' object."
                }
              ]
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  isPothole: { type: Type.BOOLEAN },
                  explanation: { type: Type.STRING },
                  size: { type: Type.STRING, enum: ["small", "medium", "large"] },
                  measurements: {
                    type: Type.OBJECT,
                    properties: {
                      widthInches: { type: Type.NUMBER },
                      lengthInches: { type: Type.NUMBER },
                      depthInches: { type: Type.NUMBER }
                    },
                    required: ["widthInches", "lengthInches", "depthInches"]
                  }
                },
                required: ["isPothole", "explanation", "size"]
              }
            }
          });

          const result = JSON.parse(response.text);
          if (result.isPothole) {
            const optimized = await resizeImage(rawBase64);
            setReportImage(optimized);
            setReportMeasurements({
              ...result.measurements,
              size: result.size
            });
            
            // Map AI size to severity
            if (result.size === 'small') setReportSeverity('low');
            else if (result.size === 'medium') setReportSeverity('medium');
            else if (result.size === 'large') setReportSeverity('high');
          } else {
            alert(`INVALID IMAGE: ${result.explanation}`);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }
        } catch (error) {
          console.error("AI Validation error:", error);
          // Fallback: allow if AI fails but resize anyway
          const optimized = await resizeImage(rawBase64);
          setReportImage(optimized);
        } finally {
          setIsValidatingImage(false);
        }
      };
      reader.readAsDataURL(file);

      // Refresh location on capture if not already found
      if (!reportLocation) {
        startGeolocation();
      }
    }
  };

  const submitReport = async (shouldPay: boolean = false) => {
    if (!reportImage || (!reportLocation && !reportAddress)) return;
    if (!reportName || !reportEmail || !reportPhone) {
      alert("Please fill in your contact information so we can reach you.");
      return;
    }

    setIsReporting(true);
    
    // Support non-secure contexts or older browsers
    const reportId = typeof crypto?.randomUUID === 'function' 
      ? crypto.randomUUID() 
      : Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      
    const finalPrice = reportMeasurements 
      ? getPrice(reportMeasurements.widthInches, reportMeasurements.lengthInches, reportMeasurements.depthInches)
      : getPrice(reportSeverity);

    const newReport: PotholeReport = {
      id: reportId,
      userId: user?.uid || 'anonymous',
      userEmail: user?.email || 'anonymous',
      reporterName: reportName,
      reporterPhone: reportPhone,
      reporterEmail: reportEmail,
      imageUrl: reportImage,
      location: {
        latitude: reportLocation?.lat || (reportAddress ? 38.2527 : 0),
        longitude: reportLocation?.lng || (reportAddress ? -85.7585 : 0),
      },
      status: 'pending',
      paymentStatus: 'unpaid',
      price: finalPrice,
      severity: reportSeverity,
      description: reportDescription,
      createdAt: Date.now(),
    };

    if (reportAddress) {
      newReport.location.address = reportAddress;
    }

    if (reportMeasurements) {
      newReport.measurements = reportMeasurements;
    }

    try {
      // 1. Save to Database First
      await setDoc(doc(db, 'reports', reportId), newReport);
      
      // 2. Notify Admin & Customer
      try {
        console.log("Notifying system of new report...");
        await fetch('/api/notify-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report: newReport }),
        });
      } catch (notifyErr) {
        console.error("Background notification failed:", notifyErr);
      }

      // 3. Handle Payment if requested
      if (shouldPay) {
        await handlePayment(newReport);
        // handlePayment redirects the window, so we don't need to do anything else
        return;
      }

      // Cleanup & UI Feedback
      setShowReportModal(false);
      resetReportForm(); 

      // Google Ads Conversion Tracking (Optional/Default)
      if (typeof window.gtag === 'function' && !shouldPay) {
        window.gtag('event', 'conversion', {
          'send_to': 'AW-18105279174/DUhNCMmPp6AcEMbForlD',
          'value': newReport.price,
          'currency': 'USD',
          'transaction_id': reportId
        });
      }

      alert("SUCCESS: Potential hazard reported. Our team has been notified and will review the submission shortly.");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reports');
    } finally {
      setIsReporting(false);
    }
  };

  const resetReportForm = () => {
    setReportImage(null);
    setReportLocation(null);
    setReportAddress('');
    setReportDescription('');
    setReportSeverity('medium');
    setReportMeasurements(null);
    setReportName('');
    setReportEmail('');
    setReportPhone('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateStatus = async (reportId: string, newStatus: PotholeReport['status']) => {
    if (!isAdmin) return;
    
    try {
      await updateDoc(doc(db, 'reports', reportId), { status: newStatus });
      const currentReport = reports.find(r => r.id === reportId);
      if (currentReport) {
        setSelectedReport({ ...currentReport, status: newStatus });
        
        // Notify of status change
        fetch('/api/notify-status-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report: currentReport, newStatus }),
        }).catch(err => console.error("Status notification failed:", err));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  const updatePaymentStatus = async (reportId: string, newStatus: PotholeReport['paymentStatus']) => {
    if (!isAdmin) return;
    
    try {
      await updateDoc(doc(db, 'reports', reportId), { paymentStatus: newStatus });
      setSelectedReport(prev => prev ? { ...prev, paymentStatus: newStatus } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  const updatePrice = async (reportId: string, newPrice: number) => {
    if (!isAdmin) return;
    
    try {
      await updateDoc(doc(db, 'reports', reportId), { price: newPrice });
      const currentReport = reports.find(r => r.id === reportId);
      if (currentReport) {
        setSelectedReport({ ...currentReport, price: newPrice });
        
        // Notify of price change
        fetch('/api/notify-price-change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report: currentReport, newPrice }),
        }).catch(err => console.error("Price notification failed:", err));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  const sendCustomSMS = async (report: PotholeReport) => {
    if (!isAdmin || !smsMessageToSend.trim()) return;
    
    setIsSendingSMS(true);
    try {
      const response = await fetch('/api/send-custom-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: report.id,
          customerPhone: report.reporterPhone,
          message: smsMessageToSend
        }),
      });
      
      if (response.ok) {
        alert("SUCCESS: Text message dispatched to customer.");
        setSmsMessageToSend('');
      } else {
        const err = await response.json();
        alert(`FAILED: ${err.error || "Could not send SMS"}`);
      }
    } catch (error) {
      console.error("SMS error:", error);
      alert("ERROR: System communication failure.");
    } finally {
      setIsSendingSMS(false);
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!isAdmin) return;
    setReportToDelete(reportId);
  };

  const confirmDelete = async () => {
    if (!reportToDelete || !isAdmin) return;
    
    const reportId = reportToDelete;
    setReportToDelete(null); // Close modal first for UX

    try {
      await deleteDoc(doc(db, 'reports', reportId));
      setSelectedReport(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reports/${reportId}`);
    }
  };

  const handleVerifyPhoto = async (reportId: string, status: 'verified' | 'rejected', reason?: string) => {
    if (!isAdmin) return;
    
    try {
      const updateData = {
        photoVerification: {
          status,
          reason: reason || null,
          verifiedAt: Date.now(),
          verifiedBy: user?.email || 'admin'
        }
      };
      await updateDoc(doc(db, 'reports', reportId), updateData);
      setSelectedReport(prev => prev ? { ...prev, ...updateData } : null);

      // Trigger notification if rejected
      if (status === 'rejected' && reason && selectedReport) {
        try {
          await fetch('/api/notify-photo-rejection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              report: selectedReport,
              reason: reason
            })
          });
        } catch (error) {
          console.error("Failed to send rejection notification:", error);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
      </div>
    );
  }

  // If not logged in OR not an admin OR explicitly showing landing -> Show Public Experience
  if (!user || !isAdmin || showLanding) {
    return (
      <ErrorBoundary>
        <div className="relative">
          <LandingPage 
            onLogin={() => {
              if (user && isAdmin) {
                setShowLanding(false);
              } else {
                handleLogin();
              }
            }} 
            onReport={handleOpenReportModal} 
            isLoading={isLoggingIn} 
            isLoggedIn={!!user && isAdmin}
          />
          
          <ReportModal 
            isOpen={showReportModal}
            onClose={() => setShowReportModal(false)}
            onCapture={handleCapture}
            onSubmit={submitReport}
            isReporting={isReporting}
            isValidatingImage={isValidatingImage}
            isLocating={isLocating}
            reportImage={reportImage}
            reportLocation={reportLocation}
            reportAddress={reportAddress}
            setReportAddress={setReportAddress}
            reportSeverity={reportSeverity}
            setReportSeverity={setReportSeverity}
            reportDescription={reportDescription}
            setReportDescription={setReportDescription}
            reportMeasurements={reportMeasurements}
            fileInputRef={fileInputRef}
            // New Props
            reportName={reportName}
            setReportName={setReportName}
            reportPhone={reportPhone}
            setReportPhone={setReportPhone}
            reportEmail={reportEmail}
            setReportEmail={setReportEmail}
            onRefreshLocation={startGeolocation}
          />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-paper flex h-screen overflow-hidden">
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          {/* Header */}
          <header className="p-8 pb-4 flex items-center gap-6">
            <button 
              onClick={() => setShowLanding(true)}
              className="hover:scale-105 transition-transform active:scale-95 cursor-pointer"
            >
              <Logo className="w-32 h-32 md:w-40 md:h-40" />
            </button>
          </header>

          {/* View Toggle & Content */}
          <div className="flex-1 flex flex-col px-8 pb-8 overflow-hidden">
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
              {isAdmin && (
                <button 
                  onClick={() => setView('admin')}
                  className={cn(
                    "px-6 py-2 font-black uppercase tracking-tighter border-4 border-ink transition-all",
                    view === 'admin' ? "bg-neon bold-shadow" : "bg-paper hover:bg-muted"
                  )}
                >
                  Admin Portal
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
                    <MarkerClusterGroup
                      chunkedLoading
                      maxClusterRadius={60}
                      iconCreateFunction={createCustomClusterIcon}
                    >
                      {reports.filter(r => r.location.latitude !== 0 && r.location.longitude !== 0).map(report => (
                        <Marker 
                          key={report.id} 
                          position={[report.location.latitude, report.location.longitude]}
                          eventHandlers={{
                            click: () => {
                              setSelectedReport(report);
                              // On desktop, we don't want the popup to open automatically if we are showing the side panel
                            },
                          }}
                        >
                          <Popup closeButton={false} minWidth={200}>
                            <div className="p-1 font-sans">
                              <img src={report.imageUrl} alt="Pothole" className="w-full h-24 object-cover border-2 border-ink mb-2" />
                              <div className="flex justify-between items-center mb-2">
                                <p className="font-black text-[10px] uppercase">{report.status}</p>
                                <p className="font-black text-xs tracking-tighter">${report.price || 'TBD'}</p>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedReport(report);
                                }}
                                className="w-full py-2 bg-neon border-2 border-ink text-[8px] font-black uppercase tracking-widest hover:bg-ink hover:text-paper transition-all"
                              >
                                View Details
                              </button>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </MarkerClusterGroup>
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
                  <div className="flex items-center gap-4 mb-8">
                    <button 
                      onClick={() => setAdminTab('reports')}
                      className={cn(
                        "px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-ink transition-all",
                        adminTab === 'reports' ? "bg-ink text-paper" : "bg-paper hover:bg-muted"
                      )}
                    >
                      Report Management
                    </button>
                    <button 
                      onClick={() => setAdminTab('users')}
                      className={cn(
                        "px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-ink transition-all",
                        adminTab === 'users' ? "bg-ink text-paper" : "bg-paper hover:bg-muted"
                      )}
                    >
                      User Management
                    </button>
                  </div>

                  {adminTab === 'reports' ? (
                    <>
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
                            <th className="p-4 border-r border-paper/20">Photo</th>
                            <th className="p-4 border-r border-paper/20">ID</th>
                            <th className="p-4 border-r border-paper/20">Status</th>
                            <th className="p-4 border-r border-paper/20">Payment</th>
                            <th className="p-4 border-r border-paper/20">Price</th>
                            <th className="p-4 border-r border-paper/20">Reporter</th>
                            <th className="p-4 border-r border-paper/20">Contact</th>
                            <th className="p-4 border-r border-paper/20">Date</th>
                            <th className="p-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="font-bold text-xs uppercase">
                          {reports.map(report => (
                            <tr key={report.id} className="border-b-2 border-ink hover:bg-muted cursor-pointer" onClick={() => setSelectedReport(report)}>
                              <td className="p-2 border-r-2 border-ink">
                                <div className="w-12 h-12 border-2 border-ink bg-muted overflow-hidden">
                                  <img 
                                    src={report.imageUrl} 
                                    className="w-full h-full object-cover" 
                                    alt="Thumb" 
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              </td>
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
                              <td className="p-4 border-r-2 border-ink truncate max-w-[150px]">
                                <div className="font-black">{report.reporterName}</div>
                                <div className="text-[10px] opacity-50">{report.reporterEmail}</div>
                              </td>
                              <td className="p-4 border-r-2 border-ink font-mono text-[10px]">{report.reporterPhone}</td>
                              <td className="p-4 border-r-2 border-ink">{new Date(report.createdAt).toLocaleDateString()}</td>
                              <td className="p-4">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteReport(report.id);
                                  }}
                                  className="p-2 border-2 border-ink bg-red-500 text-paper hover:bg-ink transition-colors bold-shadow active:translate-y-0.5"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-black uppercase tracking-tighter">User Directory</h3>
                        <p className="text-[10px] font-bold opacity-50 uppercase tracking-widest">{allUsers.length} total profiles recorded</p>
                      </div>
                      
                      <div className="border-4 border-ink overflow-hidden bg-paper">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-ink text-paper uppercase text-[10px] font-black tracking-widest">
                              <th className="p-4 border-r border-paper/20">Name</th>
                              <th className="p-4 border-r border-paper/20">Email</th>
                              <th className="p-4 border-r border-paper/20">Current Role</th>
                              <th className="p-4 border-r border-paper/20">Joined</th>
                              <th className="p-4">Promote/Demote</th>
                            </tr>
                          </thead>
                          <tbody className="font-bold text-xs uppercase">
                            {allUsers.map(u => (
                              <tr key={u.uid} className="border-b-2 border-ink hover:bg-muted/50">
                                <td className="p-4 border-r-2 border-ink">{u.displayName}</td>
                                <td className="p-4 border-r-2 border-ink font-mono lowercase">{u.email}</td>
                                <td className="p-4 border-r-2 border-ink">
                                  <span className={cn(
                                    "px-3 py-1 text-[9px] font-black border-2 border-ink",
                                    u.role === 'admin' ? "bg-red-500 text-paper" : 
                                    u.role === 'technician' ? "bg-neon text-ink" : "bg-muted text-ink"
                                  )}>
                                    {u.role}
                                  </span>
                                </td>
                                <td className="p-4 border-r-2 border-ink opacity-50">{new Date(u.createdAt).toLocaleDateString()}</td>
                                <td className="p-4">
                                  <div className="flex gap-2">
                                    {(['customer', 'technician', 'admin'] as const).map(role => (
                                      <button
                                        key={role}
                                        onClick={() => handleUpdateUserRole(u.uid, role)}
                                        disabled={u.role === role || u.email === 'vik@quickfixpothole.com'}
                                        className={cn(
                                          "px-2 py-1 text-[8px] font-black uppercase border-2 border-ink transition-all disabled:opacity-20",
                                          u.role === role ? "bg-ink text-paper" : "bg-paper hover:bg-neon"
                                        )}
                                      >
                                        {role}
                                      </button>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="bg-yellow-100 border-2 border-yellow-400 p-4 flex gap-4 items-start">
                        <ShieldAlert className="w-6 h-6 text-yellow-600 flex-shrink-0" />
                        <div className="text-[10px] space-y-1">
                          <p className="font-black uppercase text-yellow-800 tracking-widest">Administrative Warning</p>
                          <p className="font-bold text-yellow-700">Changing a user's role grants them immediate access to restricted system operations including report deletions and financial overrides. Proceed with extreme caution.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Floating Action Button */}
          {view !== 'admin' && (
            <button 
              onClick={handleOpenReportModal}
              className="absolute bottom-12 right-12 w-20 h-20 bg-neon text-ink border-4 border-ink bold-shadow flex items-center justify-center hover:scale-105 transition-transform z-40"
            >
              <Plus className="w-10 h-10" />
            </button>
          )}
        </main>

        {/* Side Panel */}
        <aside className="w-[400px] border-l-4 border-ink flex flex-col bg-paper flex-shrink-0 hidden lg:flex">
          <AnimatePresence mode="wait">
            {selectedReport ? (
              <motion.div
                key="detail"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="h-full"
              >
                <ReportDetailContent 
                  report={selectedReport}
                  isAdmin={isAdmin}
                  onClose={() => setSelectedReport(null)}
                  onUpdatePayment={updatePaymentStatus}
                  onDelete={deleteReport}
                  smsMessage={smsMessageToSend}
                  setSmsMessage={setSmsMessageToSend}
                  isSendingSMS={isSendingSMS}
                  onSendSMS={sendCustomSMS}
                  onUpdateStatus={updateStatus}
                  onRequestPayment={handleRequestPayment}
                  isRequestingPayment={isRequestingPayment}
                  onVerifyPhoto={handleVerifyPhoto}
                  onUpdatePrice={updatePrice}
                />
              </motion.div>
            ) : (
              <motion.div
                key="stats"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="h-full p-10 flex flex-col"
              >
                <div className="mb-12 space-y-4 flex-shrink-0">
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
                  <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                    {reports.slice(0, 5).map(report => (
                      <div key={report.id} className="pb-6 border-b border-muted cursor-pointer hover:bg-muted/50 p-2 transition-colors" onClick={() => setSelectedReport(report)}>
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-1 flex justify-between items-center">
                          <span>{new Date(report.createdAt).toLocaleTimeString()} • {report.severity}</span>
                          <CountdownTimer createdAt={report.createdAt} status={report.status} />
                        </div>
                        <div className="font-bold text-base leading-tight uppercase mb-2">
                          {report.description || "New pothole reported"}
                        </div>
                        <div className="inline-block px-2 py-0.5 bg-ink text-paper text-[9px] font-black uppercase tracking-widest">
                          {report.status}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        {/* Report Modal */}
        <ReportModal 
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          onCapture={handleCapture}
          onSubmit={submitReport}
          isReporting={isReporting}
          isValidatingImage={isValidatingImage}
          isLocating={isLocating}
          reportImage={reportImage}
          reportLocation={reportLocation}
          reportAddress={reportAddress}
          setReportAddress={setReportAddress}
          reportSeverity={reportSeverity}
          setReportSeverity={setReportSeverity}
          reportDescription={reportDescription}
          setReportDescription={setReportDescription}
          reportMeasurements={reportMeasurements}
          fileInputRef={fileInputRef}
          // New Props
          reportName={reportName}
          setReportName={setReportName}
          reportPhone={reportPhone}
          setReportPhone={setReportPhone}
          reportEmail={reportEmail}
          setReportEmail={setReportEmail}
          onRefreshLocation={startGeolocation}
        />

        {/* Detail Modal (Mobile Only) */}
        <AnimatePresence>
          {selectedReport && (
            <div className="fixed inset-0 z-[100] flex items-stretch justify-center p-0 lg:hidden">
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
                className="relative bg-white w-full border-ink overflow-hidden bold-shadow flex flex-col h-full"
              >
                <div className="flex flex-col h-full">
                  <ReportDetailContent 
                    report={selectedReport}
                    isAdmin={isAdmin}
                    onClose={() => setSelectedReport(null)}
                    onUpdatePayment={updatePaymentStatus}
                    onDelete={deleteReport}
                    smsMessage={smsMessageToSend}
                    setSmsMessage={setSmsMessageToSend}
                    isSendingSMS={isSendingSMS}
                    onSendSMS={sendCustomSMS}
                    onUpdateStatus={updateStatus}
                    onRequestPayment={handleRequestPayment}
                    isRequestingPayment={isRequestingPayment}
                    onVerifyPhoto={handleVerifyPhoto}
                    onUpdatePrice={updatePrice}
                  />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

          {/* Delete Confirmation Modal */}
          <AnimatePresence>
            {reportToDelete && (
              <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setReportToDelete(null)}
                  className="absolute inset-0 bg-ink/80 backdrop-blur-md"
                />
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0, rotate: -2 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="relative bg-paper w-full max-w-md border-8 border-ink p-12 text-center space-y-8 bold-shadow"
                >
                  <div className="flex justify-center">
                    <div className="p-6 bg-red-500 border-4 border-ink">
                      <AlertTriangle className="w-12 h-12 text-paper" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-4xl font-black uppercase tracking-tighter leading-none">DANGER ZONE</h3>
                    <p className="text-sm font-bold uppercase opacity-60 leading-relaxed">
                      You are about to <span className="text-red-600 underline decoration-4 underline-offset-4">permanently destroy</span> this repair ticket. This action is irreversible and the data will be purged from the central ledger.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <button 
                      onClick={confirmDelete}
                      className="py-4 bg-red-600 text-paper font-black uppercase text-sm tracking-[0.3em] border-4 border-ink shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                    >
                      CONFIRM DESTRUCTION
                    </button>
                    <button 
                      onClick={() => setReportToDelete(null)}
                      className="py-4 bg-paper text-ink font-black uppercase text-xs tracking-widest border-4 border-ink hover:bg-muted transition-colors"
                    >
                      ABORT ACTION
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Bright Bottom Banner */}
          <div className="fixed bottom-0 left-0 right-0 z-[500] bg-neon text-ink border-t-4 border-ink py-1 overflow-hidden pointer-events-none">
            <div className="flex animate-marquee-slower whitespace-nowrap">
              {Array.from({ length: 20 }).map((_, i) => (
                <span key={i} className="text-[10px] font-black uppercase tracking-widest mx-8">
                  WWW.QUICKFIXPOTHOLE.COM <span className="text-ink/20 px-2">⚡</span>
                </span>
              ))}
            </div>
          </div>
      </div>
    </ErrorBoundary>
  );
}
