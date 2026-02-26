import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

function getApiBaseUrl() {
  return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
}

async function getUser(accessToken: string) {
  const response = await fetch(`${getApiBaseUrl()}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return response.json();
}

export async function POST(request: NextRequest) {
  let payload: { identifier?: string; password?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ code: 'INVALID_JSON', message: 'Payload invalido' }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    return NextResponse.json({ code: 'API_UNAVAILABLE', message: 'Backend indisponivel' }, { status: 502 });
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ code: 'AUTH_FAILED', message: 'Falha ao autenticar' }));
    return NextResponse.json(error, { status: response.status });
  }

  const data = await response.json();
  const cookieStore = await cookies();
  const isSecure = request.nextUrl.protocol === 'https:' || process.env.COOKIE_SECURE === 'true';
  cookieStore.set('refresh_token', data.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    path: '/',
    maxAge: data.refreshTokenExpiresIn,
  });

  const user = await getUser(data.accessToken);

  return NextResponse.json({
    accessToken: data.accessToken,
    accessTokenExpiresIn: data.accessTokenExpiresIn,
    refreshTokenExpiresIn: data.refreshTokenExpiresIn,
    user,
  });
}
