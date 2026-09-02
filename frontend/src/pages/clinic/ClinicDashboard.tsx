import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import {
  CalendarDays, Users, Star as StarIcon, Siren, Check, CheckCheck,
  Building2, ArrowRight, Clock, PawPrint, Stethoscope,
} from 'lucide-react';
import { api, unwrap } from '@/lib/api';
import {
  Card, Button, Stars, StatusPill, SkeletonCard, EmptyState, Spinner,
} from '@/components/ui';
import type { Appointment, EmergencyRequest } from '@/types';
import { PageShell, ErrorState, useMyClinic } from './_shared';

interface ClinicAnalytics {
  appointments_today: number;
  total_patients: number;
  avg_rating: number;
  rating_count: number;
  emergency_requests_open: number;
  status_breakdown?: Record<string, number>;
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

export default function ClinicDashboard() {
  const qc = useQueryClient();
  const { data: clinic, isLoading: clinicLoading, isError: clinicError, refetch: refetchClinic } = useMyClinic();

  const today = format(new Date(), 'yyyy-MM-dd');

  const analyticsQ = useQuery({
    queryKey: ['analytics', 'clinic'],
    queryFn: () => unwrap<ClinicAnalytics>(api.get('/analytics/clinic')),
    enabled: !!clinic,
  });

  const apptsQ = useQuery({
    queryKey: ['appointments', { date: today }],
    queryFn: () => unwrap<Appointment[]>(api.get('/appointments', { params: { date: today } })),
    enabled: !!clinic,
  });

  const emergencyQ = useQuery({
    queryKey: ['emergency', { status: 'OPEN' }],
    queryFn: () => unwrap<EmergencyRequest[]>(api.get('/emergency', { params: { status: 'OPEN' } })),
    enabled: !!clinic,
  });

  const actMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'confirm' | 'complete' }) =>
      api.patch(`/appointments/${id}`, { action }),
    onSuccess: (_d, v) => {
      toast.success(v.action === 'confirm' ? 'Appointment confirmed' : 'Marked completed');
      qc.invalidateQueries({ queryKey: ['appointments'] });
      qc.invalidateQueries({ queryKey: ['analytics', 'clinic'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const todays = apptsQ.data ?? [];
  const emergencies = emergencyQ.data ?? [];

  const sortedToday = useMemo(
    () => [...todays].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
    [todays]
  );

  // ── No clinic yet → registration CTA ───────────────────────────────────────
  if (clinicLoading) {
    return (
      <PageShell title="Dashboard">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </PageShell>
    );
  }
  if (clinicError) {
    return (
      <PageShell title="Dashboard">
        <ErrorState message="Could not load your clinic." onRetry={() => refetchClinic()} />
      </PageShell>
    );
  }
  if (!clinic) {
    return (
      <PageShell title="Welcome to VetConnect">
        <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-brand-50 text-brand-600">
            <Building2 className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">Register your clinic to get started</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              Set up your clinic profile so pet owners around Ikerre and Ekiti can find you, book appointments,
              and reach you in emergencies.
            </p>
          </div>
          <Link to="/clinic/profile">
            <Button icon={<Building2 className="h-4 w-4" />}>Register your clinic</Button>
          </Link>
        </Card>
      </PageShell>
    );
  }

  const a = analyticsQ.data;

  return (
    <PageShell
      title={`Hi, ${clinic.name}`}
      subtitle={`${format(new Date(), 'EEEE, d MMMM yyyy')} · ${clinic.town ?? 'Ikerre'}`}
      actions={<StatusPill status={clinic.status} />}
    >
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {analyticsQ.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              icon={<CalendarDays className="h-6 w-6 text-brand-700" />}
              accent="bg-brand-50"
              label="Appointments today"
              value={a?.appointments_today ?? todays.length}
            />
            <StatCard
              icon={<Users className="h-6 w-6 text-sand-600" />}
              accent="bg-sand-50"
              label="Total patients"
              value={a?.total_patients ?? '—'}
            />
            <StatCard
              icon={<StarIcon className="h-6 w-6 text-amber-500" />}
              accent="bg-amber-50"
              label="Average rating"
              value={a ? Number(a.avg_rating || 0).toFixed(1) : Number(clinic.rating_avg || 0).toFixed(1)}
              foot={<Stars value={a?.avg_rating ?? clinic.rating_avg ?? 0} size={13} />}
            />
            <StatCard
              icon={<Siren className="h-6 w-6 text-rose-600" />}
              accent="bg-rose-50"
              label="Open emergencies"
              value={a?.emergency_requests_open ?? emergencies.length}
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Today's appointments */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Today's appointments</h2>
            <Link to="/clinic/appointments" className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {apptsQ.isLoading ? (
            <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
          ) : apptsQ.isError ? (
            <ErrorState message="Could not load appointments." onRetry={() => apptsQ.refetch()} />
          ) : sortedToday.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="h-6 w-6" />}
              title="No appointments today"
              description="When owners book for today, they'll appear here."
            />
          ) : (
            <div className="space-y-3">
              {sortedToday.map((ap) => (
                <Card key={ap.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                      <PawPrint className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">
                        {ap.animal?.name ?? 'Patient'}{' '}
                        <span className="font-normal text-ink-muted">· {ap.service}</span>
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                        <Clock className="h-3.5 w-3.5" />
                        {ap.start_time?.slice(0, 5) ?? '—'}
                        {ap.animal?.species && <span>· {ap.animal.species}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={ap.status} />
                    {ap.status === 'PENDING' && (
                      <Button
                        size="sm" variant="secondary" icon={<Check className="h-4 w-4" />}
                        loading={actMut.isPending && actMut.variables?.id === ap.id}
                        onClick={() => actMut.mutate({ id: ap.id, action: 'confirm' })}
                      >
                        Confirm
                      </Button>
                    )}
                    {ap.status === 'CONFIRMED' && (
                      <Button
                        size="sm" icon={<CheckCheck className="h-4 w-4" />}
                        loading={actMut.isPending && actMut.variables?.id === ap.id}
                        onClick={() => actMut.mutate({ id: ap.id, action: 'complete' })}
                      >
                        Complete
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Open emergencies */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Open emergencies</h2>
            {emergencyQ.isFetching && <Spinner className="h-4 w-4" />}
          </div>
          {emergencyQ.isLoading ? (
            <SkeletonCard />
          ) : emergencies.length === 0 ? (
            <EmptyState
              icon={<Siren className="h-6 w-6" />}
              title="All clear"
              description="No open emergency requests right now."
            />
          ) : (
            <div className="space-y-3">
              {emergencies.slice(0, 6).map((em) => (
                <Card key={em.id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                      <Stethoscope className="h-4 w-4 text-rose-600" />
                      {em.animal_type}
                    </span>
                    <StatusPill status={em.urgency} />
                  </div>
                  <p className="line-clamp-2 text-sm text-ink-soft">{em.symptoms}</p>
                  <div className="flex items-center justify-between text-xs text-ink-muted">
                    <span>{em.location_text ?? 'Location N/A'}</span>
                    <span>{format(parseISO(em.created_at), 'HH:mm')}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
