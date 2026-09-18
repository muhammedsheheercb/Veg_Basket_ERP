'use client';
import Link from 'next/link';
import { FileText, Home, LayoutGrid, MoreHorizontal, ShoppingCart, Truck } from 'lucide-react';
import { usePathname } from 'next/navigation';
const items=[['Home','/',Home],['Sales','/sales',FileText],['Purchases','/purchases',ShoppingCart],['Suppliers','/suppliers',Truck],['More','/settings',LayoutGrid]] as const;
export function MobileNavigation(){const path=usePathname();if(path==='/login')return null;return <nav className="global-bottom-nav" aria-label="Primary navigation">{items.map(([label,href,Icon])=>{const active=href==='/'?path==='/':path===href||path.startsWith(`${href}/`);return <Link key={label} href={href} className={active?'active':''}><Icon size={20}/><span>{label}</span></Link>})}</nav>}
