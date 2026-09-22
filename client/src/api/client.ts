import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL ?? '/api';

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('erp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('erp_token');
      localStorage.removeItem('erp_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export const apiError = (e: unknown): string => {
  if (axios.isAxiosError(e)) {
    const errs = e.response?.data?.errors;
    if (Array.isArray(errs) && errs.length) {
      return errs.map((x: { message: string }) => x.message).join(', ');
    }
    return e.response?.data?.message ?? e.message;
  }
  return 'Unexpected error';
};
