import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return <main className="management state-page"><section className="state-card card"><FileQuestion size={32}/><p className="eyebrow">404 · PAGE NOT FOUND</p><h1>This page doesn’t exist</h1><p>Check the address or return to your Veg Basket dashboard.</p><Link className="primary" href="/">Go to dashboard</Link></section></main>;
}
