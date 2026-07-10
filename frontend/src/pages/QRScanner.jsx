import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrCode, Camera, ShieldAlert, CheckCircle2, UserX, AlertOctagon, HelpCircle, RefreshCw } from 'lucide-react';

const QRScanner = () => {
  const { getAuthHeaders } = useAuth();
  
  // Audio synthesizer helper (chimes for security feedback)
  const playBeep = (type) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'success') {
        // High double-beep for entry allowed
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
        
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.setValueAtTime(1000, ctx.currentTime);
          gain2.gain.setValueAtTime(0.08, ctx.currentTime);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.15);
        }, 120);
      } else if (type === 'already_scanned') {
        // Warning chime
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        // Low error buzz for invalid/capacity issues
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.type = 'sawtooth';
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn('Audio check-in chime failed to synthesize:', e);
    }
  };

  const [activeTab, setActiveTab] = useState('simulated'); // 'camera' or 'simulated'
  
  // List states for mock scan dropdown
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [pendingRegistrations, setPendingRegistrations] = useState([]);
  const [selectedTicketCode, setSelectedTicketCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Scan feedback result overlay
  const [scanResult, setScanResult] = useState(null); // { status, message, attendee, eventTitle, currentCount, capacityLimit }
  
  const scannerRef = useRef(null);

  // Load events list for simulated selector
  const loadEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        console.log("SCAN RESPONSE =", data);
        setEvents(data);
        if (data.length > 0) {
          setSelectedEventId(data[0]._id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load pending tickets for selected event
  const loadPendingTickets = async () => {
  if (!selectedEventId) return;

  try {
    const res = await fetch(
      `/api/registrations/event/${selectedEventId}`,
      {
        headers: getAuthHeaders()
      }
    );

    if (res.ok) {
      const data = await res.json();

      const pending = data.filter(r => !r.checkedIn);

      setPendingRegistrations(pending);

      if (pending.length > 0) {
        setSelectedTicketCode(pending[0].ticketCode);
      } else {
        setSelectedTicketCode('');
      }
    }
  } catch (e) {
    console.error(e);
  }
};
  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    loadPendingTickets();
  }, [selectedEventId]);

  // Handle camera scanning startup
  useEffect(() => {
    if (activeTab === 'camera') {
      // Small timeout to let the viewport DOM mount properly
      setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          'qr-reader-viewport', 
          { fps: 10, qrbox: { width: 250, height: 250 } },
          /* verbose= */ false
        );

        scanner.render(
  (decodedText) => {
    handleVerifyTicket(decodedText);

    scanner.clear();

    setTimeout(() => {
      if (activeTab === 'camera') {
        scanner.render(
          (txt) => handleVerifyTicket(txt),
          (err) => console.log(err)
        );
      }
    }, 5000);
  },
  (error) => {}
);
        scannerRef.current = scanner;
      }, 500);
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.warn('Scanner shutdown issue:', e));
        scannerRef.current = null;
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(e => console.warn('Cleanup scanner error:', e));
      }
    };
  }, [activeTab]);

  const handleVerifyTicket = async (ticketCode) => {
  let parsedData = null;

  try {
    parsedData = JSON.parse(ticketCode);
    ticketCode = parsedData.ticketCode;
  } catch (err) {
    // old QR format
  }

  setLoading(true);
  setScanResult(null);

  try {
    const res = await fetch('/api/registrations/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        ticketCode
      })
    });

    const data = await res.json();

    console.log("SCAN RESPONSE =", data);

    if (data.status === 'success') {
      playBeep('success');

      alert(`
✅ Check-In Successful

Name: ${data.name}
Email: ${data.email}
Event: ${data.event}
Ticket ID: ${data.ticketId}
      `);
    } else if (data.status === 'already_scanned') {
      playBeep('already_scanned');
    } else {
      playBeep('error');
    }

    setScanResult(data);

    loadPendingTickets();

  } catch (e) {
    console.error('Scan error:', e);

    playBeep('error');

    setScanResult({
      status: 'error',
      message: 'Database network error. Ticket validation failed.'
    });
  } finally {
    setLoading(false);
  }
};

  const handleSimulatedSubmit = (e) => {
    e.preventDefault();
    if (!selectedTicketCode) return;
    handleVerifyTicket(selectedTicketCode);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Title */}
      <div className="glass-panel" style={{ padding: '2.5rem 2rem', border: '1px solid var(--border-light)' }}>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800 }}>
          Ticket Gate <span className="gradient-text">Verification</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.25rem', fontSize: '0.95rem' }}>
          Scan user entry passes to verify booking authenticity, check capacity limits, and allow gates entry.
        </p>
      </div>

      {/* Tabs */}
      <div className="tabs-header">
        <button 
          onClick={() => setActiveTab('simulated')} 
          className={`tab-btn ${activeTab === 'simulated' ? 'active' : ''}`}
        >
          Simulated Quick Scan
        </button>
        <button 
          onClick={() => setActiveTab('camera')} 
          className={`tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
        >
          Webcam Camera Scan
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Left Side: Active Scanner Interface */}
        <div>
          {activeTab === 'camera' ? (
            <div className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-start)' }}>
                <Camera size={20} />
                <h3 style={{ fontSize: '1.15rem' }}>Webcam Active Scanner</h3>
              </div>
              
              <div className="scanner-viewport">
                <div className="scanner-laser" />
                <div id="qr-reader-viewport" style={{ width: '100%' }} />
              </div>
              
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Position the user's ticket QR code centered in the green frame to scan automatically.
              </span>
            </div>
          ) : (
            // Simulated quick scan view
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-start)', marginBottom: '1.5rem' }}>
                <QrCode size={20} />
                <h3 style={{ fontSize: '1.15rem' }}>Simulated Quick Scan (No Camera)</h3>
              </div>

              <form onSubmit={handleSimulatedSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Select Active Event</label>
                  <select 
                    className="form-control" 
                    value={selectedEventId} 
                    onChange={(e) => setSelectedEventId(e.target.value)}
                  >
                    {events.map(e => <option key={e._id} value={e._id} style={{ background: 'var(--bg-secondary)', color: 'white' }}>{e.title}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Select Pending Ticket Code</label>
                  {pendingRegistrations.length === 0 ? (
                    <div style={{ 
                      padding: '0.75rem', 
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px dashed var(--border-light)', 
                      borderRadius: '8px', 
                      color: 'var(--text-muted)',
                      fontSize: '0.85rem',
                      textAlign: 'center'
                    }}>
                      All registered attendees for this event are already checked-in.
                    </div>
                  ) : (
                    <select 
                      className="form-control" 
                      value={selectedTicketCode} 
                      onChange={(e) => setSelectedTicketCode(e.target.value)}
                    >
                      {pendingRegistrations.map(r => (
                        <option key={r._id} value={r.ticketCode} style={{ background: 'var(--bg-secondary)', color: 'white' }}>
                          {r.user?.name} - {r.ticketCode}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={loading || !selectedTicketCode}
                  style={{ padding: '0.8rem', display: 'flex', gap: '0.5rem', width: '100%', marginTop: '0.5rem' }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={16} style={{ animation: 'spin 2s linear infinite' }} />
                      Checking in...
                    </>
                  ) : (
                    'Check-In Selected Ticket'
                  )}
                </button>

              </form>
            </div>
          )}
        </div>

        {/* Right Side: Scan Feedback Board */}
        <div>
          <div className="glass-panel" style={{ padding: '2rem', minHeight: '345px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {!scanResult ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <HelpCircle size={48} style={{ opacity: 0.15, marginBottom: '1rem', margin: '0 auto' }} />
                <h3 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Awaiting Gate Scans</h3>
                <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Scan a ticket QR code or perform a mock check-in to see security access results here.</p>
              </div>
            ) : (
              // Display results
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                {scanResult.status === "success" && (
  <div
    style={{
      width: "100%",
      padding: "20px",
      border: "2px solid green",
      borderRadius: "10px",
      background: "#f0fff4",
      color: "#000",
      textAlign: "left"
    }}
  >
    <h2>✅ Check-In Successful</h2>

    <p><strong>Name:</strong> {scanResult.name}</p>

    <p><strong>Email:</strong> {scanResult.email}</p>

    <p><strong>Event:</strong> {scanResult.event}</p>

    <p><strong>Ticket ID:</strong> {scanResult.ticketId}</p>

    <p>
      <strong>Crowd Count:</strong>
      {scanResult.currentCount}/{scanResult.capacityLimit}
    </p>
  </div>
)}
                {/* Result Icons */}
                {scanResult.status === 'success' && (
                  <div style={{ background: 'var(--success-glow)', border: '2px solid var(--success)', padding: '1rem', borderRadius: '50%', color: 'var(--success)' }}>
                    <CheckCircle2 size={48} />
                  </div>
                )}

                {scanResult.status === 'already_scanned' && (
                  <div style={{ background: 'var(--warning-glow)', border: '2px solid var(--warning)', padding: '1rem', borderRadius: '50%', color: 'var(--warning)' }}>
                    <UserX size={48} />
                  </div>
                )}

                {(scanResult.status === 'invalid' || scanResult.status === 'capacity_reached' || scanResult.status === 'error') && (
                  <div style={{ background: 'var(--danger-glow)', border: '2px solid var(--danger)', padding: '1rem', borderRadius: '50%', color: 'var(--danger)' }}>
                    <AlertOctagon size={48} />
                  </div>
                )}

                {/* Result Title */}
                <div>
                  <h2 style={{ 
                    fontFamily: 'var(--font-display)', 
                    fontSize: '1.75rem',
                    color: scanResult.status === 'success' ? 'var(--success)' : scanResult.status === 'already_scanned' ? 'var(--warning)' : 'var(--danger)' 
                  }}>
                    {scanResult.status === 'success' && 'ACCESS ALLOWED'}
                    {scanResult.status === 'already_scanned' && 'ALREADY SCANNED'}
                    {scanResult.status === 'capacity_reached' && 'CAPACITY REACHED'}
                    {scanResult.status === 'invalid' && 'INVALID TICKET'}
                    {scanResult.status === 'error' && 'SYSTEM ERROR'}
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                    {scanResult.message}
                  </p>
                </div>

                {/* Attendee Details Card */}
                {(scanResult.attendee || scanResult.eventTitle) && (
                  <div style={{ 
                    width: '100%', 
                    background: 'rgba(255,255,255,0.02)', 
                    border: '1px solid var(--border-light)', 
                    borderRadius: '12px',
                    padding: '1rem',
                    textAlign: 'left'
                  }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>
                      Gate Details
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                      {scanResult.attendee && <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Attendee:</span>
                        <strong style={{ fontSize: '0.9rem', color: 'white', marginLeft: '0.5rem' }}>{scanResult.attendee}</strong>
                      </div>}
                      {scanResult.eventTitle && <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Event:</span>
                        <strong style={{ fontSize: '0.9rem', color: 'white', marginLeft: '0.5rem' }}>{scanResult.eventTitle}</strong>
                      </div>}
                      {scanResult.capacityLimit && <div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Live Crowd Count:</span>
                        <strong style={{ fontSize: '0.9rem', color: 'white', marginLeft: '0.5rem' }}>
                          {scanResult.currentCount} / {scanResult.capacityLimit} Inside
                        </strong>
                      </div>}
                    </div>
                  </div>
                )}

                <button onClick={() => setScanResult(null)} className="btn btn-secondary" style={{ padding: '0.5rem 1.25rem' }}>
                  Clear Result
                </button>

              </div>
            )}
          </div>
        </div>

      </div>

      <style>{`
        /* Scanner camera styles injected to override defaults */
        #qr-reader-viewport {
          border: none !important;
        }
        #qr-reader-viewport__dashboard_section_csr button {
          background: var(--primary-gradient) !important;
          color: white !important;
          font-family: var(--font-display) !important;
          border: none !important;
          padding: 0.5rem 1rem !important;
          border-radius: 6px !important;
          cursor: pointer !important;
        }
        #qr-reader-viewport__dashboard_section_csr button:hover {
          background: var(--primary-gradient-hover) !important;
        }
        #qr-reader-viewport__status_span {
          color: white !important;
          font-size: 0.8rem !important;
        }
        @media (max-width: 800px) {
          div[style*="gridTemplateColumns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

    </div>
  );
};

export default QRScanner;
