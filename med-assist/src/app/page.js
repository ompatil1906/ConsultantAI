'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, Activity, User, PlusCircle, ShieldAlert, Cpu, UploadCloud, FileText, CheckCircle, Database, Mic, MicOff, MessageSquare, Volume2, VolumeX, Phone, PhoneOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Vapi from "@vapi-ai/web";

export default function Home() {
  const [messages, setMessages] = useState([
    { role: 'model', content: "Hello! I am MedAssist AI, your advanced health assistant.\n\nPlease note that the guidance I provide is strictly informational and is **not a replacement for professional medical advice, diagnosis, or treatment from a licensed physician**. In the event of a medical emergency, please contact your local emergency services immediately.\n\nDo I have your consent to proceed with a few questions so I can better understand and assist you today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Vapi State
  const vapiRef = useRef(null);
  const [vapiActive, setVapiActive] = useState(false);
  const [vapiPublicKey] = useState(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || '');
  const [vapiAssistantId] = useState(process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || '7f39d4d7-f641-488f-85a3-e77ccfd0acae');

  // Workspace State
  const [sessionStarted, setSessionStarted] = useState(false);
  const [callStatus, setCallStatus] = useState("inactive"); // inactive, connecting, active, error
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [indexedDocs, setIndexedDocs] = useState([]);

  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  // Initialize Vapi Instance only once
  useEffect(() => {
    if (vapiPublicKey && typeof window !== 'undefined' && !vapiRef.current) {
      console.log("Initializing MedAssist Vapi Client...");
      const vapiInstance = new Vapi(vapiPublicKey);
      vapiRef.current = vapiInstance;

      vapiInstance.on("call-start", () => {
        console.log("Call started successfully.");
        setVapiActive(true);
        setCallStatus("active");
        setSessionStarted(true);
      });

      vapiInstance.on("call-end", () => {
        console.log("Call ended.");
        setVapiActive(false);
        setCallStatus("inactive");
      });

      vapiInstance.on("message", (msg) => {
        if (msg.type === "transcript" && msg.role && msg.transcriptType === "final") {
          const transcriptRole = msg.role === 'user' ? 'user' : 'model';
          setMessages(prev => [...prev, { role: transcriptRole, content: msg.transcript }]);
        }
      });

      vapiInstance.on("error", (e) => {
        console.error("Vapi Diagnostic Error [Full]:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
        const errMsg = e.message || "A transport error occurred during the voice session.";
        setErrorMsg(`Voice Link Error: ${errMsg}`);
        setVapiActive(false);
        setCallStatus("error");
      });
    }

    return () => {
      // In development, aggressive cleanup can cause 'ejection' errors on hot reload.
      // We will rely on manual stopping or the call-end event.
      // vapiRef.current?.stop(); 
    };
  }, [vapiPublicKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startVapiCall = async () => {
    if (callStatus === "connecting" || vapiActive) return;

    if (!vapiRef.current || !vapiAssistantId) {
      setErrorMsg("Vapi Configuration Incomplete. Please ensure Public Key and Assistant ID are set in .env.local.");
      return;
    }

    setCallStatus("connecting");
    setErrorMsg(null);

    try {
      console.log("Establishing clinical link with ID:", vapiAssistantId);

      // Simple, stable start call
      await new Promise(r => setTimeout(r, 200));
      await vapiRef.current.start(vapiAssistantId);
    } catch (e) {
      console.error("Vapi Start Failure:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
      setCallStatus("error");
      setErrorMsg("Connection Failed: " + (e.message || "The assistant could not be reached. Please check your dashboard connectivity."));
      setVapiActive(false);
    }
  };

  const stopVapiCall = () => {
    if (vapiRef.current) {
      vapiRef.current.stop();
      setVapiActive(false);
      setCallStatus("inactive");
    }
  };

  const handleSendMessage = async (textToSubmit = input) => {
    if (!textToSubmit.trim() || isLoading) return;

    if (vapiActive) stopVapiCall();

    const userMessage = { role: 'user', content: textToSubmit };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch response.');
      setMessages(prev => [...prev, { role: 'model', content: data.message }]);
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/ingest', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to ingest document.');

      setUploadStatus({ type: 'success', text: data.message });
      setIndexedDocs(prev => [...prev, { name: file.name, date: new Date().toLocaleTimeString() }]);
    } catch (err) {
      setUploadStatus({ type: 'error', text: err.message });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const restartSession = () => {
    if (vapiActive) stopVapiCall();
    setSessionStarted(false);
    setCallStatus("inactive");
    setErrorMsg(null);
    setMessages([
      { role: 'model', content: "Hello! I am MedAssist AI, your advanced health assistant.\n\nPlease note that the guidance I provide is strictly informational and is **not a replacement for professional medical advice, diagnosis, or treatment from a licensed physician**. In the event of a medical emergency, please contact your local emergency services immediately.\n\nDo I have your consent to proceed with a few questions so I can better understand and assist you today?" }
    ]);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-color)' }}>
      {/* Sidebar - MedAssist Clinical Hub */}
      <aside className="glass" style={{
        width: '320px',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
        position: 'relative'
      }}>
        <div style={{ padding: '32px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 16px rgba(15, 23, 42, 0.2)' }}>
            <Activity color="#fff" size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-main)', margin: 0, letterSpacing: '-0.03em' }}>MedAssist</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clinical AI Hub</p>
          </div>
        </div>

        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {/* Mode Switcher - Modern Pill */}
          <div style={{ background: 'rgba(241, 245, 249, 0.8)', padding: '5px', borderRadius: '14px', display: 'flex', gap: '4px', marginBottom: '32px', border: '1px solid rgba(226, 232, 240, 0.5)' }}>
            <button
              onClick={() => setIsVoiceMode(true)}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', border: 'none',
                background: isVoiceMode ? 'var(--surface-color)' : 'transparent',
                color: isVoiceMode ? 'var(--primary-color)' : 'var(--text-muted)',
                boxShadow: isVoiceMode ? 'var(--shadow-md)' : 'none',
                fontWeight: isVoiceMode ? '700' : '500', fontSize: '0.9rem'
              }}
            >
              <Mic size={18} /> Voice
            </button>
            <button
              onClick={() => { setIsVoiceMode(false); if (vapiActive) stopVapiCall(); }}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', border: 'none',
                background: !isVoiceMode ? 'var(--surface-color)' : 'transparent',
                color: !isVoiceMode ? 'var(--primary-color)' : 'var(--text-muted)',
                boxShadow: !isVoiceMode ? 'var(--shadow-md)' : 'none',
                fontWeight: !isVoiceMode ? '700' : '500', fontSize: '0.9rem'
              }}
            >
              <MessageSquare size={18} /> Chat
            </button>
          </div>

          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-light)', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={14} /> Knowledge Retrieval
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.6 }}>
              Augment AI reasoning with verified clinical PDFs.
            </p>

            <button
              className="premium-button-outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ width: '100%', borderRadius: '12px', fontSize: '0.9rem' }}
            >
              {uploading ? <span className="animate-pulse">Indexing Protocol...</span> : <><UploadCloud size={18} /><span>Upload Document</span></>}
            </button>
            <input type="file" accept="application/pdf" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />
          </div>

          {uploadStatus && (
            <div className="animate-fade-in" style={{
              padding: '16px', borderRadius: '12px', fontSize: '0.8rem', display: 'flex', gap: '12px', alignItems: 'flex-start',
              background: uploadStatus.type === 'success' ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${uploadStatus.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
              color: uploadStatus.type === 'success' ? '#166534' : '#991b1b',
              marginBottom: '24px'
            }}>
              {uploadStatus.type === 'success' ? <CheckCircle size={18} style={{ flexShrink: 0 }} /> : <ShieldAlert size={18} style={{ flexShrink: 0 }} />}
              <span style={{ fontWeight: '500' }}>{uploadStatus.text}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {indexedDocs.length > 0 && <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: '700', marginBottom: '4px' }}>Active Documents</p>}
            {indexedDocs.map((doc, i) => (
              <div key={i} className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'rgba(241, 245, 249, 0.5)', borderRadius: '12px', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <FileText size={16} color="var(--primary-color)" />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: '600', margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', color: 'var(--text-main)' }}>{doc.name}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Clinical Metadata Active</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e' }}></div>
          <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enterprise Secure</span>
        </div>
      </aside>

      {/* Main Chat Interface */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Chat Header - Glassy */}
        <header className="glass" style={{ padding: '20px 40px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', margin: 0, letterSpacing: '-0.03em' }}>
              {isVoiceMode ? 'Voice Consultation' : 'Text Consultation'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: vapiActive ? '#3b82f6' : '#22c55e', animation: vapiActive ? 'pulseGlow 1s infinite' : 'none' }}></div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontWeight: '500' }}>
                {vapiActive ? 'AI Clinician Connected' : 'Ready for Protocol'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <button className="premium-button" onClick={restartSession} style={{ padding: '0.75rem 1.25rem' }}>
              <PlusCircle size={18} /> New Session
            </button>
          </div>
        </header>

        {/* Clinical Landing / Start Screen */}
        {!sessionStarted || callStatus === "inactive" || callStatus === "error" ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', textAlign: 'center' }}>
            <div className="animate-float" style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '24px', borderRadius: '32px', marginBottom: '24px' }}>
              <Activity color="var(--primary-accent)" size={64} />
            </div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '16px', letterSpacing: '-0.04em' }}>Clinical AI Consultant</h2>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', maxWidth: '500px', lineHeight: 1.7, marginBottom: '40px' }}>
              MedAssist is ready for your clinical session. Grounded in CDC protocols for safe and effective symptomatic triage.
            </p>

            <button
              className="premium-button"
              disabled={callStatus === "connecting"}
              onClick={() => {
                if (isVoiceMode) {
                  startVapiCall();
                } else {
                  setSessionStarted(true);
                  setCallStatus("active");
                }
              }}
              style={{ padding: '20px 48px', fontSize: '1.25rem', borderRadius: '24px', boxShadow: '0 20px 40px rgba(15, 23, 42, 0.15)', transition: 'all 0.4s ease' }}
            >
              {callStatus === "connecting" ? (
                <span className="animate-pulse">Establishing Secure Link...</span>
              ) : (
                <>
                  {isVoiceMode ? <Phone size={24} /> : <MessageSquare size={24} />}
                  Start Clinical Consultation
                </>
              )}
            </button>

            {errorMsg && (
              <p style={{ marginTop: '24px', color: '#dc2626', fontWeight: '600', background: '#fef2f2', padding: '12px 24px', borderRadius: '12px', border: '1px solid #fecaca' }}>
                {errorMsg}
              </p>
            )}

            <p style={{ marginTop: '32px', fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              <ShieldAlert size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
              Secure Enterprise Protocol Active
            </p>
          </div>
        ) : (
          <>
            {/* Chat View Active */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px', textAlign: 'center' }}>
                <div style={{ background: vapiActive ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)', padding: '16px', borderRadius: '24px', marginBottom: '16px', transition: 'all 0.4s' }}>
                  <Activity color={vapiActive ? '#22c55e' : 'var(--primary-accent)'} size={32} className={vapiActive ? "animate-pulse" : ""} />
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '8px' }}>
                  {vapiActive ? "Voice Consultation Active" : "Consultation in Progress"}
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '550px', lineHeight: 1.7 }}>
                  AI Consultant is evaluating your clinical situation. Transcription session is being securely logged.
                </p>
              </div>

              {messages.map((msg, idx) => (
                <div key={idx} className={msg.role === 'user' ? "chat-bubble-user" : "chat-bubble-ai"}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', opacity: 0.8 }}>
                    {msg.role === 'user' ? <User size={14} /> : <Cpu size={14} />}
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>
                      {msg.role === 'user' ? 'Patient' : 'Clinician Assistant'}
                    </span>
                  </div>
                  <div className="markdown-body">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="chat-bubble-ai" style={{ width: '100px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div className="typing-dot" style={{ animationDelay: '0s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.2s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input Form Layer (Voice or Chat) */}
            <div style={{ padding: '32px 40px', background: 'transparent', position: 'relative' }}>
              <div className="glass" style={{ maxWidth: '900px', margin: '0 auto', padding: '24px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.06)' }}>
                {isVoiceMode ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      onClick={stopVapiCall}
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: '#fee2e2',
                        color: '#dc2626',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 0 0 10px rgba(220, 38, 38, 0.1)',
                        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        animation: 'pulseGlow 1.5s infinite',
                        marginBottom: '16px'
                      }}
                    >
                      <PhoneOff size={32} />
                    </div>
                    <h4 style={{ fontSize: '1rem', fontWeight: '800', color: '#dc2626', marginBottom: '6px' }}>Terminate Call</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', fontWeight: '500' }}>
                      End the live session and finalize notes.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Type your response..."
                      style={{
                        width: '100%', padding: '18px 65px 18px 24px', borderRadius: '16px', border: '1px solid rgba(226, 232, 240, 0.8)',
                        color: 'var(--text-main)', fontSize: '1rem', outline: 'none', transition: 'all 0.3s ease', background: 'rgba(255, 255, 255, 0.5)', fontWeight: '500'
                      }}
                      onFocus={(e) => { e.target.style.borderColor = 'var(--primary-accent)'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)'; }}
                      onBlur={(e) => { e.target.style.borderColor = 'rgba(226, 232, 240, 0.8)'; e.target.style.background = 'rgba(255, 255, 255, 0.5)'; e.target.style.boxShadow = 'none'; }}
                      disabled={isLoading}
                    />
                    <button type="submit" disabled={!input.trim() || isLoading} className="premium-button" style={{ position: 'absolute', right: '10px', width: '44px', height: '44px', padding: 0, borderRadius: '12px', boxShadow: 'none' }}>
                      <Send size={20} />
                    </button>
                  </form>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
