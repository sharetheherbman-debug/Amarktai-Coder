import { NextRequest, NextResponse } from 'next/server';

// Protect /dashboard/* by checking session cookie (signature verified inside routes).
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/dashboard')) {
    const tok = req.cookies.get('amarktai_session')?.value;
    if (!tok) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
