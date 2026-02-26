import { NextRequest, NextResponse } from 'next/server';

function getApiBaseUrl() {
  return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolved = await params;
  return proxyRequest(request, resolved.path);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolved = await params;
  return proxyRequest(request, resolved.path);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolved = await params;
  return proxyRequest(request, resolved.path);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolved = await params;
  return proxyRequest(request, resolved.path);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolved = await params;
  return proxyRequest(request, resolved.path);
}

async function proxyRequest(request: NextRequest, pathParts: string[]) {
  const url = `${getApiBaseUrl()}/${pathParts.join('/')}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete('host');

  const response = await fetch(url, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
  });

  const contentType = response.headers.get('content-type') || 'application/json';
  const data = await response.arrayBuffer();

  return new NextResponse(data, {
    status: response.status,
    headers: { 'content-type': contentType },
  });
}
