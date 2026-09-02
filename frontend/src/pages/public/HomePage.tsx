import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, Siren, MapPin, Stethoscope, CalendarCheck, ShieldCheck,
  ArrowRight, BookOpen, Star, PawPrint,
} from 'lucide-react';
import { api, unwrap } from '@/lib/api';
import type { Clinic, Article } from '@/types';
import ClinicCard from '@/components/ClinicCard';
import { Button, SkeletonCard, EmptyState } from '@/components/ui';

const HERO_IMG =
  'https://images.unsplash.com/photo-1612531386530-97286d97c2d2?auto=format&fit=crop&w=1400&q=70';

const TOWNS = ['Ikerre', 'Ado-Ekiti', 'Igede', 'Ise', 'Emure', 'Ikole'];

const STEPS = [
  {
    icon: Search,
    title: 'Find a trusted clinic',
    body: 'Search verified veterinary clinics across Ikerre-Ekiti and surrounding Ekiti towns by location, service or animal type.',
  },
  {
    icon: CalendarCheck,
    title: 'Book in seconds',
    body: 'Pick a clinic, choose a slot and book an appointment for your animal — no phone tag, no waiting rooms.',
  },
  {
    icon: ShieldCheck,
    title: 'Stay on top of care',
    body: 'Track vaccinations, appointments and reminders so your animals never miss the care they need.',
  },
];

const fade = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.5 },
};

export default function HomePage() {
  const clinicsQ = useQuery({
    queryKey: ['clinics', 'featured'],
    queryFn: () => unwrap<Clinic[]>(api.get('/clinics', { params: { sort: 'rating', limit: 6 } })),
  });

  const articlesQ = useQuery({
    queryKey: ['articles', 'home'],
    queryFn: () => unwrap<Article[]>(api.get('/articles', { params: { limit: 3 } })),
  });

  return (
    <div className="flex flex-col">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <img
          src={HERO_IMG}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-900/95 via-brand-900/80 to-brand-800/70" />
        <div className="container-app relative py-16 sm:py-24 lg:py-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-brand-100 ring-1 ring-white/15">
              <PawPrint className="h-4 w-4" /> Serving Ikerre &amp; Ekiti State
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Quality veterinary care,
              <span className="text-brand-300"> close to home.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-brand-50/90">
              Find and book trusted veterinary clinics across Ikerre, Ado-Ekiti, Igede and the
              surrounding Ekiti communities — for pets, poultry and livestock alike.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/directory">
                <Button size="lg" icon={<Search className="h-5 w-5" />} className="w-full sm:w-auto">
                  Find a clinic
                </Button>
              </Link>
              <Link to="/emergency">
                <Button
                  size="lg"
                  variant="danger"
                  icon={<Siren className="h-5 w-5" />}
                  className="w-full sm:w-auto"
                >
                  Emergency help
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm text-brand-50/80">
              <span className="inline-flex -space-x-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-300 text-amber-300" />
                ))}
              </span>
              Trusted by animal owners across the corridor
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Towns served ─────────────────────────────────────── */}
      <section className="border-b border-black/[0.06] bg-white">
        <div className="container-app flex flex-wrap items-center gap-x-6 gap-y-2 py-4 text-sm">
          <span className="font-semibold text-ink-soft">Towns we serve:</span>
          {TOWNS.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 text-ink-muted">
              <MapPin className="h-4 w-4 text-brand-600" /> {t}
            </span>
          ))}
        </div>
      </section>

      {/* ── Featured clinics ─────────────────────────────────── */}
      <section className="container-app py-14 sm:py-20">
        <motion.div {...fade} className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Top-rated clinics near you</h2>
            <p className="mt-2 text-ink-muted">Highly reviewed veterinary clinics in the area.</p>
          </div>
          <Link to="/directory" className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:gap-2 sm:inline-flex">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {clinicsQ.isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : clinicsQ.isError ? (
          <EmptyState
            icon={<Stethoscope className="h-7 w-7" />}
            title="Couldn't load clinics"
            description="Please check your connection and try again."
            action={<Button onClick={() => clinicsQ.refetch()}>Retry</Button>}
          />
        ) : !clinicsQ.data?.length ? (
          <EmptyState
            icon={<Stethoscope className="h-7 w-7" />}
            title="No clinics yet"
            description="Clinics are being onboarded in your area. Check back soon."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {clinicsQ.data.map((c, i) => <ClinicCard key={c.id} clinic={c} index={i} />)}
          </div>
        )}

        <div className="mt-8 text-center sm:hidden">
          <Link to="/directory">
            <Button variant="secondary" icon={<ArrowRight className="h-4 w-4" />}>Browse all clinics</Button>
          </Link>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="bg-surface-sunken">
        <div className="container-app py-14 sm:py-20">
          <motion.div {...fade} className="mx-auto mb-12 max-w-2xl text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">How VetConnect works</h2>
            <p className="mt-3 text-ink-muted">Three simple steps to better care for your animals.</p>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.title}
                {...fade}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="card relative p-7"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-700 text-white">
                  <s.icon className="h-6 w-6" />
                </span>
                <span className="absolute right-6 top-6 font-display text-3xl font-bold text-brand-100">
                  {i + 1}
                </span>
                <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Info portal teaser ───────────────────────────────── */}
      <section className="container-app py-14 sm:py-20">
        <motion.div {...fade} className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Animal care, explained</h2>
            <p className="mt-2 text-ink-muted">Practical guides from our information portal.</p>
          </div>
          <Link to="/info" className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand-700 hover:gap-2 sm:inline-flex">
            All articles <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {articlesQ.isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : !articlesQ.data?.length ? (
          <EmptyState
            icon={<BookOpen className="h-7 w-7" />}
            title="No articles yet"
            description="Care guides are on the way."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articlesQ.data.map((a, i) => (
              <motion.div key={a.id} {...fade} transition={{ duration: 0.45, delay: i * 0.08 }}>
                <Link
                  to={`/info/${a.slug}`}
                  className="card group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-lift"
                >
                  <div className="h-40 overflow-hidden bg-brand-50">
                    <img
                      src={a.cover_url || 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?auto=format&fit=crop&w=800&q=60'}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    {a.category?.name && (
                      <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                        {a.category.name}
                      </span>
                    )}
                    <h3 className="mt-1.5 font-display text-lg font-semibold leading-snug line-clamp-2">{a.title}</h3>
                    {a.excerpt && <p className="mt-2 text-sm text-ink-muted line-clamp-2">{a.excerpt}</p>}
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700 group-hover:gap-2">
                      Read more <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* ── Emergency CTA banner ─────────────────────────────── */}
      <section className="container-app pb-16 sm:pb-24">
        <motion.div
          {...fade}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 to-red-700 px-7 py-12 text-white sm:px-12 sm:py-14"
        >
          <Siren className="absolute -right-6 -top-6 h-40 w-40 text-white/10" />
          <div className="relative max-w-2xl">
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
              Animal emergency? Don't wait.
            </h2>
            <p className="mt-3 text-rose-50/90">
              Get connected to the nearest emergency-ready clinic in minutes. Describe the symptoms,
              share your location, and we'll point you to help right away.
            </p>
            <Link to="/emergency" className="mt-6 inline-block">
              <Button
                size="lg"
                icon={<Siren className="h-5 w-5" />}
                className="bg-white text-rose-700 hover:bg-rose-50"
              >
                Get emergency help
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
