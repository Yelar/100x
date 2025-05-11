'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const BACKEND_URL = 'http://localhost:3000';

export default function Login() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is already logged in
    const userInfo = localStorage.getItem('user_info');
    if (userInfo) {
      router.push('/dashboard');
      return;
    }

    // Check for error parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    if (error) {
      console.error('Authentication error:', error);
      alert('Authentication failed. Please try again.');
    }
  }, [router]);

  const handleGoogleLogin = async () => {
    try {
      const response = await fetch('/api/auth/google');
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No auth URL received');
      }
    } catch (error) {
      console.error('Error initiating Google login:', error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Backend URL: {BACKEND_URL}
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <button
            onClick={handleGoogleLogin}
            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-3">
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                />
              </svg>
            </span>
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
}