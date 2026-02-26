import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

function getApiBaseUrl() {
  return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
}

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;

  if (refreshToken) {
    await fetch(`${getApiBaseUrl()}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshToken}` },
    });
  }

  cookieStore.delete('refresh_token');
  return NextResponse.json({ success: true });
}
