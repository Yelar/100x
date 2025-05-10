'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const BACKEND_URL = 'http://localhost:8000';

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      console.log('Received code from Google, sending to backend...');
      // Send the code to your backend
      fetch(`${BACKEND_URL}/api/auth/google/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000'
        },
        body: JSON.stringify({ code }),
      })
        .then((res) => {
          if (!res.ok) {
            return res.text().then(text => {
              throw new Error(`HTTP error! status: ${res.status}, message: ${text}`);
            });
          }
          return res.json();
        })
        .then((data) => {
          console.log('Successfully received data from backend');
          // Store the tokens in localStorage
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          localStorage.setItem('user_info', JSON.stringify(data.user_info));
          
          // Redirect to dashboard
          router.push('/dashboard');
        })
        .catch((error) => {
          console.error('Detailed error:', error);
          alert('Authentication failed. Please try again.');
          router.push('/login');
        });
    }
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Processing authentication...</h1>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
      </div>
    </div>
  );
} 