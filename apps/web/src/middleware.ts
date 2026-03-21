import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isFeatureAvailable } from '@realflow/shared';
import type { ProductType, ProductFeature } from '@realflow/shared';

// Routes that require specific product access
const GATED_ROUTE_PREFIXES: { prefix: string; feature: ProductFeature }[] = [
  { prefix: '/buyers-agent', feature: 'client_briefs' },
  { prefix: '/properties', feature: 'listings' },
  { prefix: '/social', feature: 'social_publishing' },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this route is gated
  const gate = GATED_ROUTE_PREFIXES.find((g) => pathname.startsWith(g.prefix));
  if (!gate) return NextResponse.next();

  // Create Supabase client for Edge Middleware
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Not authenticated — redirect to auth
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    return NextResponse.redirect(url);
  }

  // Read product_access from user metadata (Option C)
  // Defaults to 'both' if not set — never locks out existing users
  const productAccess = (user.user_metadata?.product_access as ProductType) ?? 'both';

  if (!isFeatureAvailable(gate.feature, productAccess)) {
    // User lacks product access — redirect to dashboard with restricted flag
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.searchParams.set('restricted', 'true');
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata)
     * - api routes (handled by API middleware)
     * - auth pages (must be accessible)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api|auth|public).*)',
  ],
};
