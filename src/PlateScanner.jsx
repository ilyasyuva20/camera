import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { createWorker } from 'tesseract.js';

export default function PlateScanner({ onConfirm, onClose }) {
  const webcamRef = useRef(null);
  const [detectedPlate, setDetectedPlate] = useState(null);
  const [status, setStatus] = useState('Initializing OCR...');
  const [workerReady, setWorkerReady] = useState(false);
  const workerRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const worker = await createWorker('eng');
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        });
        workerRef.current = worker;
        setWorkerReady(true);
        setStatus('Ready! Keep plate steady inside frame.');
      } catch (err) {
        setStatus('OCR engine failed.');
      }
    })();

    return () => {
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  const normalizeIndianPlate = (raw) => {
    if (!raw) return '';

    let text = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!text) return '';

    // Fix common OCR swaps that appear on number plates.
    text = text
      .replace(/IND/gi, '')
      .replace(/L0/g, 'KL')
      .replace(/LO/g, 'KL')
      .replace(/K0/g, 'KO')
      .replace(/IO/g, '10')
      .replace(/[O]/g, '0')
      .replace(/[Q]/g, '0')
      .replace(/[Z]/g, '2')
      .replace(/[S]/g, '5')
      .replace(/[B]/g, '8');

    const candidates = new Set([
      text,
      text.replace(/[I]/g, '1'),
      text.replace(/[L]/g, '1'),
      text.replace(/[O]/g, '0').replace(/[Q]/g, '0').replace(/[Z]/g, '2').replace(/[S]/g, '5').replace(/[B]/g, '8')
    ]);

    for (const candidate of candidates) {
      const patterns = [
        /([A-Z]{2})([0-9]{2})([A-Z]{1,3})([0-9]{4})/,
        /([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{4})/,
        /([A-Z]{2})([0-9]{2})([A-Z]{2})([0-9]{4})/
      ];

      for (const pattern of patterns) {
        const match = candidate.match(pattern);
        if (match) {
          const state = match[1];
          const reg = match[2];
          const series = match[3];
          const num = match[4];

          if (state.length === 2 && series.length >= 1) {
            return `${state} ${reg} ${series} ${num}`;
          }
        }
      }
    }

    return '';
  };

  const handleScanNow = async () => {
    if (!workerReady || !webcamRef.current) return;
    setStatus('Reading plate...');

    const video = webcamRef.current.video;
    if (!video || video.readyState !== 4) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const cropW = vw * 0.65;
    const cropH = vh * 0.22;
    const cropX = (vw - cropW) / 2;
    const cropY = (vh - cropH) / 2;

    canvas.width = cropW;
    canvas.height = cropH;
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const imgData = ctx.getImageData(0, 0, cropW, cropH);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
      const c = v > 115 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = c;
    }
    ctx.putImageData(imgData, 0, 0);

    try {
      const { data: { text } } = await workerRef.current.recognize(canvas);
      const fixedPlate = normalizeIndianPlate(text);

      if (fixedPlate) {
        setDetectedPlate(fixedPlate);
        setStatus('Success!');
      } else {
        setStatus('Could not read a valid plate. Keep the plate straight and centered.');
      }
    } catch (e) {
      setStatus('Scan error. Try again.');
    }
  };

  useEffect(() => {
    if (!workerReady || detectedPlate) return;

    const autoScanTimer = setInterval(() => {
      if (webcamRef.current?.video?.readyState === 4) {
        handleScanNow();
      }
    }, 2000);

    return () => clearInterval(autoScanTimer);
  }, [workerReady, detectedPlate]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', zIndex: 999 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px' }}>
        <button onClick={onClose} style={{ background: '#222', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer' }}>✕</button>
        <span style={{ fontSize: '14px', fontWeight: 'bold' }}>Point at number plate</span>
        <div style={{ width: 36 }} />
      </div>

      <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={{ facingMode: 'environment', width: 1280, height: 720 }}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* ഗ്രീൻ ടാർഗെറ്റ് ബോക്സ് */}
        <div style={{
          position: 'absolute',
          width: '75%',
          maxWidth: '360px',
          height: '110px',
          border: '3px solid #10b981',
          borderRadius: '16px',
          boxShadow: '0 0 25px rgba(16,185,129,0.5)',
          pointerEvents: 'none'
        }} />
      </div>

      <div style={{ textAlign: 'center', padding: '8px', fontSize: '13px', color: '#a1a1aa' }}>
        {status}
      </div>

      {detectedPlate ? (
        <div style={{ padding: '24px', background: '#18181b', borderRadius: '24px 24px 0 0', textAlign: 'center' }}>
          <input
            type="text"
            value={detectedPlate}
            onChange={(e) => setDetectedPlate(e.target.value.toUpperCase())}
            style={{
              width: '85%',
              background: '#09090b',
              border: '2px solid #10b981',
              borderRadius: '12px',
              padding: '10px',
              fontSize: '24px',
              fontFamily: 'monospace',
              fontWeight: '900',
              textAlign: 'center',
              color: '#34d399',
              letterSpacing: '2px',
              marginBottom: '16px'
            }}
          />
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#d4d4d8' }}>Is this right?</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => { setDetectedPlate(null); setStatus('Scanning again...'); }}
              style={{ padding: '12px 28px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ✕ Try Again
            </button>
            <button
              onClick={() => onConfirm(detectedPlate)}
              style={{ padding: '12px 28px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ✓ Confirm
            </button>
          </div>
        </div>
      ) : (
        <div style={{ padding: '24px', display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={handleScanNow}
            disabled={!workerReady}
            style={{
              padding: '16px 40px',
              backgroundColor: workerReady ? '#10b981' : '#52525b',
              color: '#fff',
              fontSize: '16px',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '50px',
              cursor: workerReady ? 'pointer' : 'not-allowed'
            }}
          >
            Scan Frame
          </button>
        </div>
      )}
    </div>
  );
}