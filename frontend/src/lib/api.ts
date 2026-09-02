import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';

const baseURL = (import.meta.env.VITE_API_URL as string) || '/api';

export const api = axios.create({ baseURL, timeout: 20000 });

// Attach JWT from persisted auth store on every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap the { success, data } envelope and surface friendly errors.
api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<{ error?: string }>) => {
    const status = error.response?.status;
    const message = error.response?.data?.error || error.message || 'Something went wrong';
    if (status === 401 && !location.pathname.startsWith('/login')) {
      localStorage.removeItem('vc_token');
      localStorage.removeItem('vc_user');
    }
    // Don't toast on 401 background checks; let callers decide otherwise.
    if (status && status >= 500) toast.error('Server error — please try again.');
    return Promise.reject(new Error(message));
  }
);

/** Helper returning the unwrapped `data` payload. */
export async function unwrap<T>(p: Promise<{ data: { data: T; meta?: unknown } }>): Promise<T> {
  const res = await p;
  return res.data.data;
}

export default api;
