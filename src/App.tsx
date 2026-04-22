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
  Map as MapIcon, Plus, X, ChevronRight, Info, CreditCard, Trash2
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
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [smsMessageToSend, setSmsMessageToSend] = useState('');
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);
  
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
                  text: "Analyze this image. Is it a picture of a pothole or road damage? If yes, estimate its measurements in inches (width, length, depth). Answer in JSON with a boolean 'isPothole', a short 'explanation', and 'measurements' object containing 'widthInches', 'lengthInches', and 'depthInches'. Only allow real potholes on roads."
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
                required: ["isPothole", "explanation"]
              }
            }
          });

          const result = JSON.parse(response.text);
          if (result.isPothole) {
            const optimized = await resizeImage(rawBase64);
            setReportImage(optimized);
            setReportMeasurements(result.measurements);
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
      
    const finalPrice = getPrice(reportSeverity);

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
        const notifyRes = await fetch('/api/notify-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ report: newReport }),
        });
        
        if (!notifyRes.ok) {
          const errorData = await notifyRes.json().catch(() => ({}));
          console.error("Notification API error:", errorData);
          // We don't alert here because the report IS saved, we just couldn't email
        }
      } catch (notifyErr) {
        console.error("Background notification failed:", notifyErr);
      }

      // Cleanup & UI Feedback
      setShowReportModal(false);
      resetReportForm(); 

      // Google Ads Conversion Tracking
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'conversion', {
          'send_to': 'AW-18105279174/conversion_event_placeholder', // You should replace this placeholder with your specific conversion label from Google Ads if provided.
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

  const isAdmin = profile?.role === 'admin' || user?.email === (process.env.ADMIN_EMAIL || 'vik@quickfixpothole.com');

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

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-ink"></div>
      </div>
    );
  }

  // If not logged in OR not an admin -> Show Public Experience
  if (!user || !isAdmin) {
    return (
      <ErrorBoundary>
        <div className="relative">
          <LandingPage 
            onLogin={handleLogin} 
            onReport={() => setShowReportModal(true)} 
            isLoading={isLoggingIn} 
          />
          
          <ReportModal 
            isOpen={showReportModal}
            onClose={() => setShowReportModal(false)}
            onCapture={handleCapture}
            onSubmit={submitReport}
            isReporting={isReporting}
            isValidatingImage={isValidatingImage}
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
            <Logo className="w-32 h-32 md:w-40 md:h-40" />
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
                            <th className="p-4 border-r border-paper/20">Contact</th>
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
                              <td className="p-4 border-r-2 border-ink truncate max-w-[150px]">
                                <div className="font-black">{report.reporterName}</div>
                                <div className="text-[10px] opacity-50">{report.reporterEmail}</div>
                              </td>
                              <td className="p-4 border-r-2 border-ink font-mono text-[10px]">{report.reporterPhone}</td>
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
        <ReportModal 
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          onCapture={handleCapture}
          onSubmit={submitReport}
          isReporting={isReporting}
          isValidatingImage={isValidatingImage}
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
        />

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
                      <div className="w-full text-left space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-widest border-b-2 border-ink pb-2">Reporter Details</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[8px] font-black uppercase opacity-50">Name</p>
                            <p className="text-sm font-black uppercase">{selectedReport.reporterName}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black uppercase opacity-50">Phone</p>
                            <p className="text-sm font-black uppercase italic">{selectedReport.reporterPhone}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-[8px] font-black uppercase opacity-50">Email</p>
                            <p className="text-sm font-black uppercase underline">{selectedReport.reporterEmail}</p>
                          </div>
                        </div>
                      </div>
                      
                      <QRCodeSVG 
                        value={JSON.stringify({
                          id: selectedReport.id,
                          reporter: selectedReport.reporterName,
                          phone: selectedReport.reporterPhone,
                          price: selectedReport.price,
                          location: selectedReport.location,
                          status: selectedReport.status
                        })}
                        size={160}
                        level="H"
                      />
                      <div className="space-y-1">
                        <h4 className="text-lg font-black uppercase tracking-tighter">Job Ticket</h4>
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

                    {selectedReport.measurements && (
                      <div className="bg-paper border-4 border-ink p-4 bold-shadow">
                        <label className="text-[10px] font-black uppercase tracking-widest mb-4 block opacity-50">AI Structural Analysis (Estimated)</label>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-3 bg-muted border-2 border-ink">
                            <p className="text-[9px] font-black uppercase opacity-60">Width</p>
                            <p className="text-2xl font-black">{selectedReport.measurements.widthInches}<span className="text-xs ml-0.5">IN</span></p>
                          </div>
                          <div className="text-center p-3 bg-muted border-2 border-ink">
                            <p className="text-[9px] font-black uppercase opacity-60">Length</p>
                            <p className="text-2xl font-black">{selectedReport.measurements.lengthInches}<span className="text-xs ml-0.5">IN</span></p>
                          </div>
                          <div className="text-center p-3 bg-muted border-2 border-ink">
                            <p className="text-[9px] font-black uppercase opacity-60">Depth</p>
                            <p className="text-2xl font-black text-red-600">{selectedReport.measurements.depthInches}<span className="text-xs ml-0.5">IN</span></p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Admin Controls */}
                    {isAdmin && (
                      <div className="pt-8 space-y-6 border-t-4 border-ink">
                        <h4 className="text-sm font-black uppercase tracking-widest text-center">Admin Controls</h4>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <button
                            onClick={() => updatePaymentStatus(selectedReport.id, selectedReport.paymentStatus === 'paid' ? 'unpaid' : 'paid')}
                            className={cn(
                              "flex items-center justify-center gap-2 p-4 border-4 border-ink font-black uppercase text-xs transition-all bold-shadow active:translate-y-1",
                              selectedReport.paymentStatus === 'paid' ? "bg-green-400" : "bg-paper hover:bg-green-100"
                            )}
                          >
                            <CreditCard className="w-5 h-5" />
                            {selectedReport.paymentStatus === 'paid' ? "Mark Unpaid" : "Mark as Paid"}
                          </button>
                          
                          <button
                            onClick={() => deleteReport(selectedReport.id)}
                            className="flex items-center justify-center gap-2 p-4 border-4 border-ink bg-paper text-red-600 font-black uppercase text-xs transition-all hover:bg-red-50 bold-shadow active:translate-y-1"
                          >
                            <Trash2 className="w-5 h-5" />
                            Delete Ticket
                          </button>
                        </div>

                        <div className="space-y-4 pt-6 border-t-2 border-ink">
                          <p className="text-[10px] font-black uppercase opacity-50">Quick Message to Customer</p>
                          <div className="space-y-2">
                            <textarea
                              value={smsMessageToSend}
                              onChange={(e) => setSmsMessageToSend(e.target.value)}
                              placeholder="Type a quick update..."
                              className="w-full p-3 bg-muted border-2 border-ink font-bold text-xs h-20 uppercase"
                            />
                            <button
                              disabled={isSendingSMS || !smsMessageToSend.trim()}
                              onClick={() => sendCustomSMS(selectedReport)}
                              className="w-full py-3 bg-ink text-paper font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {isSendingSMS ? "Sending..." : "Send SMS Update"}
                            </button>
                            <div className="flex gap-2">
                              {["SQUAD ARRIVING IN 5 MINS", "REPAIR COMPLETED"].map(msg => (
                                <button
                                  key={msg}
                                  onClick={() => setSmsMessageToSend(msg)}
                                  className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-muted border border-ink hover:bg-neon"
                                >
                                  {msg}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <p className="text-[10px] font-black uppercase opacity-50 text-center">Update Repair Status</p>
                          <div className="grid grid-cols-3 gap-2">
                            {(['pending', 'in-progress', 'repaired'] as const).map(s => (
                              <button
                                key={s}
                                onClick={() => updateStatus(selectedReport.id, s)}
                                className={cn(
                                  "py-3 border-4 border-ink font-black uppercase text-[10px] transition-all",
                                  selectedReport.status === s ? "bg-neon" : "bg-paper opacity-50 grayscale hover:grayscale-0 hover:opacity-100"
                                )}
                              >
                                {s === 'pending' ? 'Pending' : s === 'in-progress' ? 'Running' : 'Done'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
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
