import { cookies } from 'next/headers';

export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token');
  return token?.value || null;
} 