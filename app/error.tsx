'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="management state-page"><section className="state-card card"><AlertTriangle size={32}/><p className="eyebrow">SYSTEM ERROR</p><h1>We couldn’t load this page</h1><p>The server may be temporarily unavailable. Your saved records have not been changed.</p><button className="primary" onClick={reset}><RefreshCw size={16}/> Try again</button></section></main>;
}
