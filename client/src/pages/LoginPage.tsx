import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { apiError } from '../api/client';
import { Button, Input } from '../components/ui';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string; password: string }>();

  const onSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      navigate('/enquiries');
    } catch (e) {
      toast.error(apiError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm rounded-lg bg-white p-6 shadow">
        <h1 className="mb-1 text-xl font-bold text-gray-800">ERP Login</h1>
        <p className="mb-5 text-xs text-gray-400">admin@erp.com / admin123 &nbsp;·&nbsp; sales@erp.com / sales123</p>
        <div className="flex flex-col gap-3">
          <Input label="Email" type="email" error={errors.email?.message}
            {...register('email', { required: 'Email is required' })} />
          <Input label="Password" type="password" error={errors.password?.message}
            {...register('password', { required: 'Password is required' })} />
          <Button type="submit" loading={loading} className="mt-2 justify-center">Sign in</Button>
        </div>
      </form>
    </div>
  );
};
