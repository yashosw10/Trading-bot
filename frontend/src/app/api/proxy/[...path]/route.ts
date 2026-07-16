import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_API_URL || 'http://127.0.0.1:8000/api';
const API_KEY = process.env.API_KEY || '';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  return proxyRequest(req, resolvedParams.path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  return proxyRequest(req, resolvedParams.path);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  return proxyRequest(req, resolvedParams.path);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  return proxyRequest(req, resolvedParams.path);
}

async function proxyRequest(req: NextRequest, pathArray: string[]) {
  const path = (pathArray || []).join('/');
  const searchParams = req.nextUrl.search;
  const url = `${BACKEND_URL}/${path}${searchParams}`;

  const headers = new Headers(req.headers);
  headers.set('X-API-Key', API_KEY);
  headers.delete('host');

  let body = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await req.text();
    } catch (e) {
      body = null;
    }
  }

  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
  };
  
  if (req.method !== 'GET' && req.method !== 'HEAD' && body !== null) {
    fetchOptions.body = body;
  }

  try {
    const response = await fetch(url, fetchOptions);

    const data = await response.text();
    
    let parsedData = data;
    try {
      parsedData = JSON.parse(data);
    } catch (e) {
      // Not JSON
    }

    return NextResponse.json(parsedData, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ detail: 'Internal Server Error (Proxy)' }, { status: 500 });
  }
}
