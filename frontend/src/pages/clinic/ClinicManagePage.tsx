import { useEffect, useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Building2, MapPin, Phone, Mail, Save, Plus, X, Crosshair, Siren, Loader2,
} from 'lucide-react';
import { api, unwrap } from '@/lib/api';
import { Button, Card, Input, Textarea, Select, StatusPill, SkeletonCard } from '@/components/ui';
import type { Clinic, AnimalSpecies, OperatingHours } from '@/types';
import { PageShell, ErrorState, useMyClinic, DAYS, DAY_KEYS, TOWNS, SPECIES } from './_shared';

interface ProfileForm {
  name: string;
  description: string;
  address: string;
  town: string;
  phone: string;
  email: string;
  latitude: string;
  longitude: string;
}

function speciesLabel(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export default function ClinicManagePage() {
  const qc = useQueryClient();
  const { data: clinic, isLoading, isError, refetch } = useMyClinic();
  const isEdit = !!clinic;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProfileForm>({
    defaultValues: {
      name: '', description: '', address: '', town: 'Ikerre', phone: '', email: '',
      latitude: '', longitude: '',
    },
  });

  const [hours, setHours] = useState<OperatingHours>({});
  const [services, setServices] = useState<string[]>([]);
  const [serviceInput, setServiceInput] = useState('');
  const [animalTypes, setAnimalTypes] = useState<AnimalSpecies[]>([]);
  const [emergency, setEmergency] = useState(false);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState<{ lat: string; lng: string }>({ lat: '', lng: '' });

  // Hydrate from server data when editing.
  useEffect(() => {
    if (!clinic) return;
    reset({
      name: clinic.name ?? '',
      description: clinic.description ?? '',
      address: clinic.address ?? '',
      town: clinic.town ?? 'Ikerre',
      phone: clinic.phone ?? '',
      email: clinic.email ?? '',
      latitude: clinic.latitude != null ? String(clinic.latitude) : '',
      longitude: clinic.longitude != null ? String(clinic.longitude) : '',
    });
    setHours(clinic.operating_hours ?? {});
    setServices(clinic.services_offered ?? []);
    setAnimalTypes(clinic.animal_types ?? []);
    setEmergency(!!clinic.emergency_available);
    setCoords({
      lat: clinic.latitude != null ? String(clinic.latitude) : '',
      lng: clinic.longitude != null ? String(clinic.longitude) : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinic]);

  function setHour(key: string, field: 'open' | 'close', value: string) {
    setHours((h) => {
      const cur = h[key] ?? { open: '', close: '' };
      return { ...h, [key]: { ...cur, [field]: value } };
    });
  }

  function toggleDay(key: string, enabled: boolean) {
    setHours((h) => {
      const next = { ...h };
      if (enabled) next[key] = h[key] ?? { open: '09:00', close: '17:00' };
      else next[key] = null;
      return next;
    });
  }

  function addService() {
    const v = serviceInput.trim();
    if (!v) return;
    if (!services.includes(v)) setServices((s) => [...s, v]);
    setServiceInput('');
  }

  function onServiceKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addService();
    }
  }

  function toggleAnimal(s: AnimalSpecies) {
    setAnimalTypes((a) => (a.includes(s) ? a.filter((x) => x !== s) : [...a, s]));
  }

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      toast.error('Geolocation is not supported on this device.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) });
        setLocating(false);
        toast.success('Location captured');
      },
      (err) => {
        setLocating(false);
        toast.error(err.message || 'Could not get your location');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const saveM = useMutation({
    mutationFn: (v: ProfileForm) => {
      const lat = coords.lat || v.latitude;
      const lng = coords.lng || v.longitude;
      const payload = {
        name: v.name.trim(),
        description: v.description.trim() || null,
        address: v.address.trim(),
        town: v.town,
        phone: v.phone.trim() || null,
        email: v.email.trim() || null,
        operating_hours: hours,
        services_offered: services,
        animal_types: animalTypes,
        emergency_available: emergency,
        latitude: lat === '' ? null : Number(lat),
        longitude: lng === '' ? null : Number(lng),
      };
      return isEdit
        ? unwrap<Clinic>(api.put(`/clinics/${clinic!.id}`, payload))
        : unwrap<Clinic>(api.post('/clinics', payload));
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Clinic profile updated' : 'Clinic submitted for approval');
      qc.invalidateQueries({ queryKey: ['clinic', 'mine'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Could not save clinic'),
  });

  if (isLoading) {
    return (
      <PageShell title="Clinic profile">
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
      </PageShell>
    );
  }
  if (isError) {
    return (
      <PageShell title="Clinic profile">
        <ErrorState message="Could not load your clinic profile." onRetry={() => refetch()} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={isEdit ? 'Clinic profile' : 'Register your clinic'}
      subtitle={isEdit ? 'Keep your clinic details up to date for pet owners.' : 'Tell pet owners around Ikerre & Ekiti about your clinic.'}
      actions={isEdit ? <StatusPill status={clinic.status} /> : undefined}
    >
      {isEdit && clinic.status === 'PENDING' && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your clinic is awaiting approval by the VetConnect team. You can keep editing your details meanwhile.
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit((v) => saveM.mutate(v))}>
        {/* Basics */}
        <Card className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Building2 className="h-5 w-5 text-brand-600" /> Basic details
          </h2>
          <Input
            label="Clinic name" id="name" placeholder="e.g. Ikere Veterinary Centre"
            error={errors.name?.message}
            {...register('name', { required: 'Clinic name is required' })}
          />
          <Textarea
            label="Description" id="description"
            placeholder="A short introduction to your clinic and the care you provide."
            {...register('description')}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Address" id="address" placeholder="Street address"
              error={errors.address?.message}
              {...register('address', { required: 'Address is required' })}
            />
            <Select label="Town" id="town" {...register('town')}>
              {TOWNS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone" id="phone" type="tel" placeholder="e.g. 0801 234 5678" {...register('phone')} />
            <Input label="Email" id="email" type="email" placeholder="clinic@example.com" {...register('email')} />
          </div>
        </Card>

        {/* Operating hours */}
        <Card className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Building2 className="h-5 w-5 text-brand-600" /> Operating hours
          </h2>
          <div className="space-y-2">
            {DAY_KEYS.map((key, i) => {
              const val = hours[key];
              const enabled = !!val;
              return (
                <div key={key} className="flex flex-col gap-3 rounded-xl border border-line p-3 sm:flex-row sm:items-center">
                  <label className="flex w-32 shrink-0 cursor-pointer items-center gap-2.5 font-medium text-ink">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-line text-brand-600 focus:ring-brand-500"
                      checked={enabled}
                      onChange={(e) => toggleDay(key, e.target.checked)}
                    />
                    {DAYS[i]}
                  </label>
                  {enabled ? (
                    <div className="grid flex-1 gap-3 sm:grid-cols-2">
                      <Input label="Open" type="time" value={val?.open ?? ''} onChange={(e) => setHour(key, 'open', e.target.value)} />
                      <Input label="Close" type="time" value={val?.close ?? ''} onChange={(e) => setHour(key, 'close', e.target.value)} />
                    </div>
                  ) : (
                    <p className="flex-1 text-sm text-ink-muted">Closed</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Services */}
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Services offered</h2>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Vaccination, Surgery, Deworming"
              value={serviceInput}
              onChange={(e) => setServiceInput(e.target.value)}
              onKeyDown={onServiceKey}
              className="flex-1"
            />
            <Button type="button" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={addService}>Add</Button>
          </div>
          {services.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <span key={s} className="badge inline-flex items-center gap-1.5 bg-brand-50 text-brand-700">
                  {s}
                  <button type="button" onClick={() => setServices((arr) => arr.filter((x) => x !== s))} aria-label={`Remove ${s}`}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">No services added yet. Press Enter or comma to add.</p>
          )}
        </Card>

        {/* Animal types */}
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Animals treated</h2>
          <div className="flex flex-wrap gap-2">
            {SPECIES.map((s) => {
              const active = animalTypes.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleAnimal(s)}
                  className={`badge cursor-pointer border transition ${
                    active ? 'border-brand-500 bg-brand-100 text-brand-800' : 'border-line bg-surface text-ink-muted hover:bg-brand-50'
                  }`}
                >
                  {speciesLabel(s)}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Emergency + location */}
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Emergency &amp; location</h2>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line p-3">
            <span className="flex items-center gap-2.5 font-medium text-ink">
              <Siren className="h-5 w-5 text-rose-600" /> Available for emergencies
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-line text-brand-600 focus:ring-brand-500"
              checked={emergency}
              onChange={(e) => setEmergency(e.target.checked)}
            />
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-ink-soft">
                <MapPin className="h-4 w-4 text-brand-600" /> Map coordinates
              </span>
              <Button
                type="button" variant="secondary" size="sm"
                icon={locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
                disabled={locating}
                onClick={useMyLocation}
              >
                Use my current location
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Latitude" type="number" step="any" placeholder="6.6789" value={coords.lat} onChange={(e) => setCoords((c) => ({ ...c, lat: e.target.value }))} />
              <Input label="Longitude" type="number" step="any" placeholder="3.3958" value={coords.lng} onChange={(e) => setCoords((c) => ({ ...c, lng: e.target.value }))} />
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Phone className="h-3.5 w-3.5" /> <Mail className="h-3.5 w-3.5" />
            Owners reach you using the contact details above.
          </p>
          <Button type="submit" icon={<Save className="h-4 w-4" />} loading={saveM.isPending}>
            {isEdit ? 'Save changes' : 'Submit clinic'}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
