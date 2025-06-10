import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBIiZ6QiFrbwrWz5At-Fe3TP3O1L50fcyc",
  authDomain: "capeconnect-couriers.firebaseapp.com",
  projectId: "capeconnect-couriers",
  storageBucket: "capeconnect-couriers.firebasestorage.app",
  messagingSenderId: "502510444401",
  appId: "1:502510444401:web:4bd0c7a32a5a6e5755a0d0",
  measurementId: "G-WKS50XJ838"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// --- Firebase Initialization ---
let app;
let auth;
let db;
try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (e) {
    console.error("Firebase initialization error:", e);
}

// --- SVG Icons ---
const Logo = () => (
    <div className="flex items-center space-x-3">
        <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="42" stroke="#ffffff" strokeWidth="7"/>
            <path d="M30 75 L40 55 L60 55 L70 75 Z" fill="#ffffff"/>
        </svg>
        <span className="text-2xl font-bold text-white">Driver App</span>
    </div>
);

// --- Main Driver App Component ---
export default function DriverApp() {
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [currentDriver, setCurrentDriver] = useState(null);

    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setIsAuthReady(true);
            } else {
                 try {
                    if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
                    else await signInAnonymously(auth);
                } catch (err) { console.error("Driver App Auth failed:", err); }
            }
        });
        return () => unsubscribe();
    }, []);

    if (!isAuthReady) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-800 text-white"><p>Authenticating...</p></div>
    }
    if (!currentDriver) {
        return <DriverLogin onLogin={setCurrentDriver} />;
    }
    return <JobsDashboard driver={currentDriver} onLogout={() => setCurrentDriver(null)} />;
}

// --- Login Component ---
const DriverLogin = ({ onLogin }) => {
    const [drivers, setDrivers] = useState([]);
    const [selectedDriverId, setSelectedDriverId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!db) { setError("Database not connected."); setIsLoading(false); return; }
        const driversCollectionPath = `artifacts/${appId}/public/data/drivers`;
        const q = query(collection(db, driversCollectionPath));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setIsLoading(false);
        }, (err) => { setError("Could not fetch driver profiles."); setIsLoading(false); });
        return unsubscribe;
    }, []);

    const handleLogin = () => {
        const driver = drivers.find(d => d.id === selectedDriverId);
        if (driver) onLogin(driver);
    };
    
    const renderContent = () => {
        if (isLoading) return <p className="text-center text-gray-500">Loading drivers...</p>;
        if (error) return <p className="text-center text-red-500">{error}</p>;
        if (drivers.length === 0) return (<div className="text-center text-gray-500"><p className="font-semibold">No drivers found.</p><p className="text-sm mt-2">Please add a driver in the Admin Dashboard first.</p></div>);
        return (
            <div className="space-y-6">
                <select value={selectedDriverId} onChange={(e) => setSelectedDriverId(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg text-lg">
                    <option value="">-- Please Select --</option>
                    {drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
                </select>
                <button onClick={handleLogin} disabled={!selectedDriverId} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed">Log In</button>
            </div>
        );
    }
    return (<div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center p-4 text-white"><Logo /><div className="w-full max-w-sm mt-8 bg-white text-gray-800 rounded-lg shadow-xl p-8"><h2 className="text-2xl font-bold text-center mb-6">Select Your Profile</h2>{renderContent()}</div></div>);
};

// --- Jobs Dashboard Component ---
const JobsDashboard = ({ driver, onLogout }) => {
    const [jobs, setJobs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedJob, setSelectedJob] = useState(null);

    useEffect(() => {
        if (!db || !driver) return;
        const q = query(collection(db, `artifacts/${appId}/public/data/orders`), where("assignedDriverId", "==", driver.id), where("status", "in", ["Driver Assigned", "Collected", "In Transit"]));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setJobs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => a.createdAt.seconds - b.createdAt.seconds));
            setIsLoading(false);
        });
        return unsubscribe;
    }, [driver]);

    if (isLoading) return <div className="min-h-screen bg-gray-100 p-4 text-center"><p>Loading your jobs...</p></div>;
    if (selectedJob) return <JobDetails job={selectedJob} onBack={() => setSelectedJob(null)} />;

    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-gray-800 text-white p-4 shadow-md flex justify-between items-center">
                <div><h1 className="text-xl font-bold">My Jobs</h1><p className="text-sm opacity-80">Welcome, {driver.name}</p></div>
                <button onClick={onLogout} className="text-sm font-semibold hover:underline">Logout</button>
            </header>
            <main className="p-4 space-y-4">
                {jobs.length === 0 ? (<div className="text-center text-gray-500 mt-16"><p className="font-semibold text-lg">No active jobs assigned.</p><p>Check back later!</p></div>
                ) : ( jobs.map(job => (
                    <div key={job.id} onClick={() => setSelectedJob(job)} className="bg-white p-4 rounded-lg shadow-md cursor-pointer">
                        <div className="flex justify-between items-center">
                            <p className="font-bold text-lg text-gray-800">{job.pickupTown} → {job.deliveryTown}</p>
                            <StatusBadge status={job.status} />
                        </div>
                        <p className="text-gray-600 mt-2">To: <span className="font-medium">{job.receiverName}</span></p>
                        <p className="text-sm text-gray-500">Pickup: {job.pickupTime}</p>
                    </div>)))}
            </main>
        </div>
    );
};

// --- Job Details Component ---
const JobDetails = ({ job, onBack }) => {
    const [view, setView] = useState('details'); // 'details' or 'pod'
    const handleUpdateStatus = async (newStatus) => {
        if (!db) return;
        try {
            await updateDoc(doc(db, `artifacts/${appId}/public/data/orders`, job.id), { status: newStatus });
            if (newStatus === 'Completed') onBack();
            else job.status = newStatus; // Force a re-render for status change
        } catch (err) { console.error("Error updating status:", err); }
    };

    const getNextAction = () => {
        switch (job.status) {
            case 'Driver Assigned': return { action: () => handleUpdateStatus('Collected'), text: 'Confirm Pickup' };
            case 'Collected': return { action: () => handleUpdateStatus('In Transit'), text: 'Start Delivery Trip' };
            case 'In Transit': return { action: () => setView('pod'), text: 'Capture Proof of Delivery' };
            default: return null;
        }
    };
    
    if (view === 'pod') {
        return <ProofOfDelivery job={job} onComplete={onBack} onBack={() => setView('details')} />;
    }
    
    const nextAction = getNextAction();

    return (
         <div className="min-h-screen bg-gray-100">
             <header className="bg-gray-800 text-white p-4 shadow-md flex items-center"><button onClick={onBack} className="mr-4 text-2xl font-bold">&larr;</button><h1 className="text-xl font-bold">Job Details</h1></header>
            <main className="p-4 space-y-6">
                <div className="bg-white p-4 rounded-lg shadow space-y-4">
                    <div><h3 className="font-bold text-blue-600 text-lg">Pickup</h3><p><strong>{job.senderName}</strong></p><p>{job.senderContact}</p><p>{job.senderAddress}, {job.pickupTown}, {job.senderPostal}</p></div><hr/>
                    <div><h3 className="font-bold text-green-600 text-lg">Delivery</h3><p><strong>{job.receiverName}</strong></p><p>{job.receiverContact}</p><p>{job.receiverAddress}, {job.deliveryTown}, {job.receiverPostal}</p></div><hr/>
                    <div><h3 className="font-bold text-gray-700 text-lg">Details</h3><p><strong>Pickup Time:</strong> {job.pickupTime}</p><p><strong>Instructions:</strong> {job.packageDescription || 'None'}</p></div>
                </div>
                 {nextAction && <button onClick={nextAction.action} className="w-full bg-green-600 text-white font-bold py-4 rounded-lg text-xl shadow-lg hover:bg-green-700">{nextAction.text}</button>}
            </main>
        </div>
    );
};

// --- Proof of Delivery (POD) Component ---
const ProofOfDelivery = ({ job, onComplete, onBack }) => {
    const [recipientName, setRecipientName] = useState('');
    const signaturePadRef = useRef(null);

    const handleCompleteDelivery = async () => {
        if (!recipientName) { alert("Please enter the recipient's name."); return; }
        // In a real app, you would also check if a signature or photo was captured.

        const updates = {
            status: 'Completed',
            podRecipientName: recipientName,
            completedAt: new Date()
            // In a real app, you would upload the signature/photo to storage
            // and save the URL here, e.g., podSignatureUrl: '...'
        };

        try {
            await updateDoc(doc(db, `artifacts/${appId}/public/data/orders`, job.id), updates);
            onComplete(); // Go back to the jobs list
        } catch (err) { console.error("Error completing delivery:", err); }
    };

    return (
         <div className="min-h-screen bg-gray-100">
             <header className="bg-gray-800 text-white p-4 shadow-md flex items-center"><button onClick={onBack} className="mr-4 text-2xl font-bold">&larr;</button><h1 className="text-xl font-bold">Proof of Delivery</h1></header>
            <main className="p-4 space-y-6">
                <div className="bg-white p-4 rounded-lg shadow space-y-4">
                    <div>
                        <label htmlFor="recipientName" className="block text-sm font-medium text-gray-700">Recipient's Printed Name</label>
                        <input type="text" id="recipientName" value={recipientName} onChange={e => setRecipientName(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Recipient's Signature</label>
                        <SignaturePad ref={signaturePadRef} />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Photo Proof</label>
                        <button className="mt-1 w-full p-3 border-2 border-dashed rounded-md text-gray-500 hover:bg-gray-50">Tap to Capture Photo</button>
                        <p className="text-xs text-center text-gray-400 mt-1">(Photo capture functionality is a placeholder)</p>
                    </div>
                </div>
                <button onClick={handleCompleteDelivery} className="w-full bg-blue-600 text-white font-bold py-4 rounded-lg text-xl shadow-lg hover:bg-blue-700">Complete Delivery</button>
            </main>
        </div>
    );
};

// --- Signature Pad Component ---
const SignaturePad = React.forwardRef((props, ref) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, []);

    const getPosition = (event) => {
        const rect = canvasRef.current.getBoundingClientRect();
        if (event.touches) {
            return { x: event.touches[0].clientX - rect.left, y: event.touches[0].clientY - rect.top };
        }
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        const { x, y } = getPosition(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const { x, y } = getPosition(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = (e) => {
        e.preventDefault();
        const ctx = canvasRef.current.getContext('2d');
        ctx.closePath();
        setIsDrawing(false);
    };

    const clearPad = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    React.useImperativeHandle(ref, () => ({
        clear: clearPad,
        getSignature: () => canvasRef.current.toDataURL('image/png') // In real app, upload this data
    }));

    return (
        <div className="relative">
            <canvas
                ref={canvasRef}
                width={300}
                height={150}
                className="bg-gray-50 border border-gray-300 rounded-md w-full"
                onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
            />
            <button onClick={clearPad} className="absolute top-2 right-2 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">Clear</button>
        </div>
    );
});


// --- Helper Components ---
const StatusBadge = ({ status }) => {
    const baseClasses = "px-2 inline-flex text-xs leading-5 font-semibold rounded-full";
    const statusClasses = { 'Driver Assigned': 'bg-yellow-100 text-yellow-800', 'Collected': 'bg-purple-100 text-purple-800', 'In Transit': 'bg-indigo-100 text-indigo-800' };
    return <span className={`${baseClasses} ${statusClasses[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
};
