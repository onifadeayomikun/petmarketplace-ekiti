import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Users, Building2, Clock, CalendarDays, Siren, ArrowRight, Star as StarIcon, Flag, Trophy,
} from 'lucide-react';
import { api, unwrap } from '@/lib/api';
import { Card, Stars, SkeletonCard, EmptyState } from '@/components/ui';
import { PageShell, ErrorState } from './_shared';

interface TopClinic {
  id: string;
  name: string;
  rating_avg: number;
  rating_count: number;
  town?: string | null;
  slug?: string | null;
}

interface AdminAnalytics {
  total_users: number;
  total_clinics: number;
  pending_clinics: number;
  total_appointments: number;
  emergency_open: number;
  emergency_total: number;
  top_clinics: TopClinic[];
}

function StatCard({
  icon, label, value, accent, foot,
}: { icon: React.ReactNode; label: string; value: React.ReactNode; accent: string; foot?: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${accent}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
        <div className="mt-0.5 text-2xl font-bold leading-none text-ink">{value}</div>
        {foot && <div className="mt-1 text-xs text-ink-muted">{foot}</div>}
      </div>
    </Card>
  );
}

export default function AdminDashboard() {
  const analyticsQ = useQuery({
    queryKey: ['analytics', 'admin'],
    queryFn: () => unwrap<AdminAnalytics>(api.get('/analytics/admin')),
    staleTime: 30_000,
  });

  const a = analyticsQ.data;
  const topClinics = a?.top_clinics ?? [];

  return (
    <PageShell
      title="Platform overview"
      subtitle="System health and moderation queues across VetConnect Ekiti"
    >
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {analyticsQ.isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
        ) : analyticsQ.isError ? (
          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-5">
            <ErrorState message="Could not load analytics." onRetry={() => analyticsQ.refetch()} />
          </div>
        ) : (
          <>
            <StatCard
              icon={<Users className="h-6 w-6 text-brand-700" />}
              accent="bg-brand-50"
              label="Total users"
              value={a?.total_users ?? '—'}
            />
            <StatCard
              icon={<Building2 className="h-6 w-6 text-sand-600" />}
              accent="bg-sand-50"
              label="Total clinics"
              value={a?.total_clinics ?? '—'}
            />
            <StatCard
              icon={<Clock className="h-6 w-6 text-amber-600" />}
              accent="bg-amber-50"
              label="Pending clinics"
              value={a?.pending_clinics ?? 0}
            />
            <StatCard
              icon={<CalendarDays className="h-6 w-6 text-emerald-600" />}
              accent="bg-emerald-50"
              label="Total appointments"
              value={a?.total_appointments ?? '—'}
            />
            <StatCard
              icon={<Siren className="h-6 w-6 text-rose-600" />}
              accent="bg-rose-50"
              label="Open emergencies"
              value={a?.emergency_open ?? 0}
              foot={a ? `${a.emergency_total} total` : undefined}
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Top-rated clinics */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-ink">
              <Trophy className="h-5 w-5 text-amber-500" /> Top-rated clinics
            </h2>
            <Link
              to="/admin/clinics"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              All clinics <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {analyticsQ.isLoading ? (
            <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
          ) : topClinics.length === 0 ? (
            <EmptyState
              icon={<StarIcon className="h-6 w-6" />}
              title="No rated clinics yet"
              description="Once clinics start receiving reviews, the leaders will appear here."
            />
          ) : (
            <Card className="divide-y divide-line p-0">
              {topClinics.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{c.name}</p>
                    {c.town && <p className="text-xs text-ink-muted">{c.town}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <Stars value={c.rating_avg ?? 0} size={14} showValue />
                    <span className="text-xs text-ink-muted">{c.rating_count ?? 0} reviews</span>
                  </div>
                </motion.div>
              ))}
            </Card>
          )}
        </div>

        {/* Quick links / queues */}
        <div className="space-y-3">
          <h2 className="mb-3 text-lg font-semibold text-ink">Action queues</h2>
          <Link to="/admin/clinics?status=PENDING">
            <Card className="flex items-center gap-3 transition hover:shadow-lift">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">Pending clinics</p>
                <p className="text-xs text-ink-muted">Review & approve new clinics</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-800">
                {a?.pending_clinics ?? 0}
              </span>
            </Card>
          </Link>

          <Link to="/admin/reviews?status=FLAGGED">
            <Card className="flex items-center gap-3 transition hover:shadow-lift">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                <Flag className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">Flagged reviews</p>
                <p className="text-xs text-ink-muted">Moderate reported content</p>
              </div>
              <ArrowRight className="h-4 w-4 text-ink-muted" />
            </Card>
          </Link>

          <Link to="/admin/emergency?status=OPEN">
            <Card className="flex items-center gap-3 transition hover:shadow-lift">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                <Siren className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-ink">Open emergencies</p>
                <p className="text-xs text-ink-muted">Monitor & assign requests</p>
              </div>
              <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-sm font-semibold text-rose-800">
                {a?.emergency_open ?? 0}
              </span>
            </Card>
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
