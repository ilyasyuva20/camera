import React, { useState } from 'react';
import PlateScanner from './PlateScanner';

export default function App() {
  const [showScanner, setShowScanner] = useState(true);
  const [confirmedPlate, setConfirmedPlate] = useState(null);

  const handleSuccess = (plateNumber) => {
    setConfirmedPlate(plateNumber);
    setShowScanner(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      {showScanner ? (
        <PlateScanner
          onConfirm={handleSuccess}
          onClose={() => setShowScanner(false)}
        />
      ) : (
        <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 max-w-xs w-full shadow-2xl">
          <p className="text-xs text-gray-400 font-medium">Vehicle Confirmed</p>
          <h2 className="text-3xl font-mono font-black text-emerald-400 tracking-wider">
            {confirmedPlate}
          </h2>
          <button
            onClick={() => setShowScanner(true)}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition"
          >
            Scan Again
          </button>
        </div>
      )}
    </div>
  );
}