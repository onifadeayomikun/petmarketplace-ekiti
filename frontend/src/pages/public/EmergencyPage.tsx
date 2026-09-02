import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Siren, Phone, MapPin, LocateFixed, CheckCircle2, AlertTriangle, Navigation,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api, unwrap } from '@/lib/api';
import type { AnimalSpecies, UrgencyLevel, Clinic, EmergencyRequest } from '@/types';
import { Button, Input, Textarea, Select, Spinner } from '@/components/ui';

const ANIMALS: AnimalSpecies[] = ['DOG', 'CAT', 'POULTRY', 'GOAT', 'SHEEP', 'CATTLE', 'RABBIT', 'OTHER'];
const URGENCY: { value: UrgencyLevel; label: string }[] = [
  { value: 'LOW', label: 'Low — needs attention soon' },
  { value: 'MODERATE', label: 'Moderate — worsening condition' },
  { value: 'HIGH', label: 'High — urgent care needed' },
  { value: 'CRITICAL', label: 'Critical — life-threatening' },
];

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

interface FormValues {
  animal_type: AnimalSpecies | '';
  symptoms: string;
  location_text: string;
  phone: string;
  urgency: UrgencyLevel;
}

interface EmergencyResult {
  request: EmergencyRequest;
  suggested_clinics: Clinic[];
}

export default function EmergencyPage() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [result, setResult] = useState<EmergencyResult | null>(null);

  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { urgency: 'HIGH', animal_type: '' } });

  const contactsQ = useQuery({
    queryKey: ['emergency-contacts'],
    queryFn: () => unwrap<Clinic[]>(api.get('/emergency/contacts')),
  });

  const detectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Location is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        setCoords({ lat: c.latitude, lng: c.longitude });
        setLocating(false);
        toast.success('Location captured.');
      },
      () => {
        toast.error('Could not get your location.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await unwrap<EmergencyResult>(
        api.post('/emergency', {
          animal_type: values.animal_type,
          symptoms: values.symptoms,
          location_text: values.location_text,
          phone: values.phone,
          urgency: values.urgency,
          ...(coords ? { latitude: coords.lat, longitude: coords.lng } : {}),
        })
      );
      setResult(res);
      toast.success('Emergency request sent.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      toast.error((e as Error).message || 'Could not send request.');
    }
  };

  return (
    <div className="bg-surface-sunken pb-16">
      {/* Banner */}
      <section className="bg-gradient-to-br from-rose-600 to-red-700 text-white">
        <div className="container-app py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-white/20">
              <Siren className="h-4 w-4" /> Emergency assistance
            </span>
            <h1 className="mt-5 font-display text-3xl font-bold sm:text-4xl">
              Get help for your animal, fast.
            </h1>
            <p className="mt-3 text-rose-50/90">
              Tell us what's happening. We'll connect you with the nearest emergency-ready clinics in
              the Ikerre-Ekiti &amp; Ekiti State area right away.
            </p>
          </motion.div>
        </div>
      </section>

      <div className="container-app grid gap-8 pt-8 lg:grid-cols-3">
        {/* Form / Result */}
        <div className="lg:col-span-2">
          {result ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="card flex items-start gap-3 border-l-4 border-success bg-white p-6">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" />
                <div>
                  <h2 className="font-display text-lg font-semibold">Your request was sent</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Below are emergency-ready clinics we suggest. Call them directly — every second counts.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-3 font-display text-xl font-bold">Suggested clinics</h3>
                {result.suggested_clinics.length ? (
                  <div className="space-y-3">
                    {result.suggested_clinics.map((c) => (
                      <ClinicContactRow key={c.id} clinic={c} />
                    ))}
                  </div>
                ) : (
                  <p className="card p-6 text-sm text-ink-muted">
                    No specific clinics matched right now — please use the emergency contacts list.
                  </p>
                )}
              </div>

              <Button variant="secondary" onClick={() => setResult(null)}>
                Submit another request
              </Button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="card space-y-5 p-6 sm:p-8">
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                For immediate life-threatening cases, call a clinic directly while you complete this form.
              </div>

              <Select
                label="Type of animal"
                error={errors.animal_type?.message}
                {...register('animal_type', { required: 'Please select an animal type' })}
              >
                <option value="">Select animal…</option>
                {ANIMALS.map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}
              </Select>

              <Textarea
                label="Symptoms / what's happening"
                placeholder="Describe the symptoms, injuries or behaviour you're seeing…"
                error={errors.symptoms?.message}
                {...register('symptoms', {
                  required: 'Please describe the symptoms',
                  minLength: { value: 10, message: 'Please add a little more detail' },
                })}
              />

              <div>
                <Input
                  label="Your location"
                  placeholder="Area / landmark, e.g. Ikerre, near College junction"
                  error={errors.location_text?.message}
                  {...register('location_text', { required: 'Please enter your location' })}
                />
                <button
                  type="button"
                  onClick={detectLocation}
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
                >
                  {locating ? <Spinner className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" />}
                  {coords ? 'Location attached ✓' : 'Use my current location'}
                </button>
              </div>

              <Input
                label="Phone number"
                type="tel"
                inputMode="tel"
                placeholder="080…"
                error={errors.phone?.message}
                {...register('phone', {
                  required: 'A phone number is required',
                  pattern: { value: /^[0-9+\s-]{7,}$/, message: 'Enter a valid phone number' },
                })}
              />

              <Select label="Urgency level" {...register('urgency')}>
                {URGENCY.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </Select>

              <Button
                type="submit"
                size="lg"
                variant="danger"
                loading={isSubmitting}
                icon={!isSubmitting && <Siren className="h-5 w-5" />}
                block
              >
                Send emergency request
              </Button>
            </form>
          )}
        </div>

        {/* Emergency contacts */}
        <aside>
          <div className="card p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
              <Phone className="h-5 w-5 text-danger" /> Emergency contacts
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Clinics ready to respond 24/7.</p>

            {contactsQ.isLoading ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16 w-full" />)}
              </div>
            ) : !contactsQ.data?.length ? (
              <p className="mt-4 text-sm text-ink-muted">No emergency contacts available right now.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {contactsQ.data.map((c) => (
                  <li key={c.id} className="rounded-xl border border-black/[0.06] p-3">
                    <p className="font-semibold text-ink">{c.name}</p>
                    {c.town && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                        <MapPin className="h-3.5 w-3.5" /> {c.town}
                      </p>
                    )}
                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
                      >
                        <Phone className="h-4 w-4" /> {c.phone}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ClinicContactRow({ clinic }: { clinic: Clinic }) {
  return (
    <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{clinic.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink-muted">
          {clinic.town && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {clinic.town}</span>}
          {typeof clinic.distance_km === 'number' && (
            <span className="inline-flex items-center gap-1"><Navigation className="h-3.5 w-3.5" /> {clinic.distance_km.toFixed(1)} km away</span>
          )}
        </p>
      </div>
      {clinic.phone && (
        <a href={`tel:${clinic.phone}`} className="shrink-0">
          <Button variant="danger" icon={<Phone className="h-4 w-4" />}>Call now</Button>
        </a>
      )}
    </div>
  );
}
