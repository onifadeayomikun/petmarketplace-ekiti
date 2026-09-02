import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import type { AuthResponse, UserRole } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { Button, Input, Select } from '@/components/ui';
import AuthShell from './AuthShell';

const TOWNS = ['Ikerre', 'Ado-Ekiti', 'Igede', 'Ise', 'Emure', 'Ikole', 'Other'];

const dashboardFor = (role: UserRole) =>
  role === 'SUPER_ADMIN' ? '/admin/dashboard' : role === 'CLINIC_ADMIN' ? '/clinic/dashboard' : '/app/dashboard';

interface FormValues {
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  role: Extract<UserRole, 'OWNER' | 'CLINIC_ADMIN'>;
  location: string;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPw, setShowPw] = useState(false);

  const {
    register, handleSubmit, watch, formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { role: 'OWNER', location: 'Ikerre' } });

  const onSubmit = async (values: FormValues) => {
    try {
      const res = await api.post('/auth/register', {
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        password: values.password,
        role: values.role,
        location: values.location,
      });
      const { token, user } = res.data.data as AuthResponse;
      setAuth(token, user);
      toast.success('Account created — welcome to VetConnect!');
      navigate(dashboardFor(user.role), { replace: true });
    } catch (e) {
      toast.error((e as Error).message || 'Could not create your account.');
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join VetConnect to find clinics and manage animal care."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link></>}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Full name"
          autoComplete="name"
          placeholder="Jane Doe"
          error={errors.full_name?.message}
          {...register('full_name', { required: 'Full name is required', minLength: { value: 2, message: 'Too short' } })}
        />

        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
          })}
        />

        <Input
          label="Phone number"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="080…"
          error={errors.phone?.message}
          {...register('phone', {
            required: 'Phone number is required',
            pattern: { value: /^[0-9+\s-]{7,}$/, message: 'Enter a valid phone number' },
          })}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="I am a…" error={errors.role?.message} {...register('role', { required: true })}>
            <option value="OWNER">Animal Owner</option>
            <option value="CLINIC_ADMIN">Clinic Administrator</option>
          </Select>
          <Select label="Location" error={errors.location?.message} {...register('location', { required: 'Select a town' })}>
            {TOWNS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>

        <div className="relative">
          <Input
            label="Password"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            error={errors.password?.message}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'Use at least 8 characters' },
            })}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-[34px] text-ink-muted hover:text-ink-soft"
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        <Input
          label="Confirm password"
          type={showPw ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          error={errors.confirm?.message}
          {...register('confirm', {
            required: 'Please confirm your password',
            validate: (v) => v === watch('password') || 'Passwords do not match',
          })}
        />

        <Button type="submit" loading={isSubmitting} icon={!isSubmitting && <UserPlus className="h-5 w-5" />} block>
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
