import Link from 'next/link';
import { LockKeyhole } from 'lucide-react';

export default function UnauthorizedPage() {
  return <main className="management state-page"><section className="state-card card"><LockKeyhole size={32}/><p className="eyebrow">UNAUTHORIZED</p><h1>You don’t have access</h1><p>Please sign in with an authorized Veg Basket account to continue.</p><Link className="primary" href="/login">Sign in</Link></section></main>;
}
