import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Search, SlidersHorizontal, LocateFixed, Stethoscope, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api, unwrap } from '@/lib/api';
import type { Clinic, AnimalSpecies, PageMeta } from '@/types';
import ClinicCard from '@/components/ClinicCard';
import { Button, Input, Select, SkeletonCard, EmptyState, Spinner } from '@/components/ui';

const TOWNS = ['Ikerre', 'Ado-Ekiti', 'Igede', 'Ise', 'Emure', 'Ikole'];
const ANIMALS: AnimalSpecies[] = ['DOG', 'CAT', 'POULTRY', 'GOAT', 'SHEEP', 'CATTLE', 'RABBIT', 'OTHER'];
const SORTS = [
  { value: 'rating', label: 'Highest rated' },
  { value: 'reviews', label: 'Most reviewed' },
  { value: 'newest', label: 'Newest' },
];

interface Filters {
  search: string;
  town: string;
  service: string;
  animal_type: string;
  emergency: boolean;
  minRating: string;
  sort: string;
}

const EMPTY: Filters = {
  search: '', town: '', service: '', animal_type: '', emergency: false, minRating: '', sort: 'rating',
};

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

interface ClinicsPage { data: Clinic[]; meta: PageMeta }

export default function DirectoryPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [nearby, setNearby] = useState<Clinic[] | null>(null);
  const [locating, setLocating] = useState(false);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
    setNearby(null);
  };

  const limit = 9;
  const clinicsQ = useQuery({
    queryKey: ['clinics', 'directory', filters, page],
    enabled: !nearby,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit, sort: filters.sort };
      if (filters.search) params.search = filters.search;
      if (filters.town) params.town = filters.town;
      if (filters.service) params.service = filters.service;
      if (filters.animal_type) params.animal_type = filters.animal_type;
      if (filters.emergency) params.emergency = true;
      if (filters.minRating) params.minRating = filters.minRating;
      const res = await api.get('/clinics', { params });
      return { data: res.data.data as Clinic[], meta: res.data.meta as PageMeta };
    },
  });

  const findNearby = () => {
    if (!navigator.geolocation) {
      toast.error('Location is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const data = await unwrap<Clinic[]>(
            api.get('/geo/nearby', {
              params: {
                lat: coords.latitude,
                lng: coords.longitude,
                radius: 25,
                emergency: filters.emergency || undefined,
              },
            })
          );
          setNearby(data);
          if (!data.length) toast('No clinics found within 25km.', { icon: '📍' });
        } catch {
          toast.error("Couldn't find nearby clinics.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        toast.error('Location permission denied.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const result = nearby ? { data: nearby, meta: null as PageMeta | null } : (clinicsQ.data as ClinicsPage | undefined);
  const clinics = result?.data ?? [];
  const meta = nearby ? null : (clinicsQ.data?.meta ?? null);
  const isLoading = !nearby && clinicsQ.isLoading;

  const hasActiveFilters =
    filters.search || filters.town || filters.service || filters.animal_type || filters.emergency || filters.minRating;

  return (
    <div className="bg-surface-sunken">
      {/* Header */}
      <div className="border-b border-black/[0.06] bg-white">
        <div className="container-app py-8 sm:py-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <h1 className="font-display text-3xl font-bold sm:text-4xl">Clinic directory</h1>
            <p className="mt-2 text-ink-muted">
              Browse verified veterinary clinics across Ikerre-Ekiti &amp; Ekiti State.
            </p>
          </motion.div>

          {/* Search + actions */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                value={filters.search}
                onChange={(e) => set('search', e.target.value)}
                placeholder="Search by clinic name or keyword…"
                className="input pl-11"
                aria-label="Search clinics"
              />
            </div>
            <Button
              variant="secondary"
              icon={<SlidersHorizontal className="h-4 w-4" />}
              onClick={() => setShowFilters((v) => !v)}
              className="sm:w-auto"
            >
              Filters
            </Button>
            <Button
              icon={locating ? <Spinner className="h-4 w-4 text-white" /> : <LocateFixed className="h-4 w-4" />}
              onClick={findNearby}
              disabled={locating}
              className="sm:w-auto"
            >
              Near me
            </Button>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 overflow-hidden"
            >
              <div className="grid gap-4 rounded-2xl border border-black/[0.06] bg-surface-sunken p-4 sm:grid-cols-2 lg:grid-cols-3">
                <Select label="Town" value={filters.town} onChange={(e) => set('town', e.target.value)}>
                  <option value="">All towns</option>
                  {TOWNS.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
                <Input
                  label="Service"
                  value={filters.service}
                  onChange={(e) => set('service', e.target.value)}
                  placeholder="e.g. Surgery, Vaccination"
                />
                <Select label="Animal type" value={filters.animal_type} onChange={(e) => set('animal_type', e.target.value)}>
                  <option value="">All animals</option>
                  {ANIMALS.map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}
                </Select>
                <Select label="Minimum rating" value={filters.minRating} onChange={(e) => set('minRating', e.target.value)}>
                  <option value="">Any rating</option>
                  <option value="4">4★ &amp; up</option>
                  <option value="3">3★ &amp; up</option>
                  <option value="2">2★ &amp; up</option>
                </Select>
                <Select label="Sort by" value={filters.sort} onChange={(e) => set('sort', e.target.value)}>
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
                <label className="flex cursor-pointer items-center gap-3 self-end rounded-xl border border-ink-muted/25 bg-white px-3.5 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={filters.emergency}
                    onChange={(e) => set('emergency', e.target.checked)}
                    className="h-4 w-4 rounded border-ink-muted/40 text-brand-700 focus:ring-brand-500"
                  />
                  <span className="font-medium text-ink-soft">24/7 Emergency only</span>
                </label>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={() => { setFilters(EMPTY); setPage(1); setNearby(null); }}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700"
                >
                  <X className="h-4 w-4" /> Clear filters
                </button>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="container-app py-8 sm:py-10">
        {nearby && (
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink-soft">
              Showing {nearby.length} clinic{nearby.length === 1 ? '' : 's'} near you
            </p>
            <button onClick={() => setNearby(null)} className="text-sm font-medium text-brand-700">
              Clear
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : clinicsQ.isError && !nearby ? (
          <EmptyState
            icon={<Stethoscope className="h-7 w-7" />}
            title="Couldn't load clinics"
            description="Please check your connection and try again."
            action={<Button onClick={() => clinicsQ.refetch()}>Retry</Button>}
          />
        ) : !clinics.length ? (
          <EmptyState
            icon={<Search className="h-7 w-7" />}
            title="No clinics found"
            description="Try adjusting your search or filters to see more results."
            action={hasActiveFilters
              ? <Button variant="secondary" onClick={() => { setFilters(EMPTY); setNearby(null); }}>Clear filters</Button>
              : undefined}
          />
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {clinics.map((c, i) => <ClinicCard key={c.id} clinic={c} index={i} />)}
            </div>

            {meta && meta.totalPages > 1 && (
              <div className="mt-10 flex items-center justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<ChevronLeft className="h-4 w-4" />}
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <span className="px-3 text-sm font-medium text-ink-soft">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
