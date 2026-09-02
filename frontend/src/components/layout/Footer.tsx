import { Link } from 'react-router-dom';
import { PawPrint, MapPin } from 'lucide-react';

const TOWNS = ['Ikerre', 'Ado-Ekiti', 'Igede', 'Ise', 'Emure', 'Ikole'];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-black/[0.06] bg-white">
      <div className="container-app grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-white">
              <PawPrint className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold text-ink">VetConnect</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-ink-muted">
            Connecting animal owners and livestock farmers with trusted veterinary care across
            Ekiti State, Nigeria.
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink">Explore</h4>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            <li><Link to="/directory" className="hover:text-brand-700">Clinic Directory</Link></li>
            <li><Link to="/info" className="hover:text-brand-700">Information Portal</Link></li>
            <li><Link to="/emergency" className="hover:text-brand-700">Emergency Assistance</Link></li>
            <li><Link to="/register" className="hover:text-brand-700">Create an account</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink">For Clinics</h4>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            <li><Link to="/register" className="hover:text-brand-700">List your clinic</Link></li>
            <li><Link to="/login" className="hover:text-brand-700">Clinic login</Link></li>
            <li><Link to="/info" className="hover:text-brand-700">Veterinary resources</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-ink">Areas served</h4>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            {TOWNS.map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-brand-500" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-black/[0.06]">
        <div className="container-app flex flex-col items-center justify-between gap-2 py-5 text-xs text-ink-muted sm:flex-row">
          <p>© {new Date().getFullYear()} VetConnect Ekiti. All rights reserved.</p>
          <p>Ekiti State · Nigeria</p>
        </div>
      </div>
    </footer>
  );
}
