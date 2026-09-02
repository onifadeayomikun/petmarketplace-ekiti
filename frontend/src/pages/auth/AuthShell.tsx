import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PawPrint, Stethoscope, ShieldCheck, MapPin } from 'lucide-react';

const BRAND_IMG =
  'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=1000&q=70';

const PERKS = [
  { icon: Stethoscope, text: 'Verified clinics across Ikerre & Ekiti State' },
  { icon: ShieldCheck, text: 'Track appointments, vaccinations & records' },
  { icon: MapPin, text: 'Find nearby emergency-ready care fast' },
];

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Centered auth card with a brand panel on desktop. Shared by all auth pages. */
export default function AuthShell({ title, subtitle, children, footer }: Props) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel (desktop) */}
      <div className="relative hidden overflow-hidden bg-brand-900 lg:block">
        <img src={BRAND_IMG} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/95 via-brand-900/85 to-brand-800/70" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <PawPrint className="h-6 w-6" />
            </span>
            <span className="font-display text-xl font-bold">VetConnect</span>
          </Link>

          <div>
            <h2 className="font-display text-3xl font-bold leading-tight">
              Caring for animals across Ekiti State.
            </h2>
            <ul className="mt-8 space-y-4">
              {PERKS.map((p) => (
                <li key={p.text} className="flex items-center gap-3 text-brand-50/90">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                    <p.icon className="h-5 w-5" />
                  </span>
                  {p.text}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-brand-50/60">© {new Date().getFullYear()} VetConnect Ekiti</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-surface-sunken px-4 py-10 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-white">
              <PawPrint className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold text-ink">VetConnect</span>
          </Link>

          <div className="card p-6 sm:p-8">
            <h1 className="font-display text-2xl font-bold">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>

          {footer && <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>}
        </motion.div>
      </div>
    </div>
  );
}
