/**
 * Optimized Image Component
 *
 * Wrapper around Next.js Image with:
 * - Automatic blur placeholder generation
 * - Responsive sizing based on container
 * - Lazy loading by default (eager for above-fold)
 * - Priority flag for LCP images
 * - Supabase Storage URL transformation for optimised delivery
 *
 * Usage:
 *   <OptimizedImage
 *     src="/storage/v1/object/public/photos/property-1.jpg"
 *     alt="Property exterior"
 *     aspect="property"
 *   />
 */

'use client';

import Image, { type ImageProps } from 'next/image';
import { useState, useCallback } from 'react';
import { clsx } from 'clsx';

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Predefined aspect ratios for common real estate image types */
type AspectRatio = 'property' | 'avatar' | 'thumbnail' | 'hero' | 'square' | 'wide';

interface OptimizedImageProps extends Omit<ImageProps, 'placeholder' | 'blurDataURL'> {
  /** Predefined aspect ratio. Overrides width/height if set. */
  aspect?: AspectRatio;
  /** Show a shimmer placeholder while loading. Defaults to true. */
  showPlaceholder?: boolean;
  /** Supabase Storage bucket name for URL transformation. */
  bucket?: string;
  /** Cloudinary cloud name for URL transformation. */
  cloudinaryCloud?: string;
  /** Container class name for the wrapper div. */
  containerClassName?: string;
}

// ─── Aspect Ratio Config ────────────────────────────────────────────────────────

const ASPECT_RATIOS: Record<AspectRatio, { width: number; height: number; sizes: string }> = {
  property: {
    width: 800,
    height: 600,
    sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  },
  avatar: {
    width: 80,
    height: 80,
    sizes: '80px',
  },
  thumbnail: {
    width: 200,
    height: 150,
    sizes: '(max-width: 640px) 50vw, 200px',
  },
  hero: {
    width: 1920,
    height: 600,
    sizes: '100vw',
  },
  square: {
    width: 400,
    height: 400,
    sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px',
  },
  wide: {
    width: 1200,
    height: 400,
    sizes: '100vw',
  },
};

// ─── Shimmer Placeholder ────────────────────────────────────────────────────────

/**
 * Generate an inline SVG shimmer placeholder as a base64 data URL.
 * This provides a nice loading animation without external dependencies.
 */
function generateBlurPlaceholder(width: number, height: number): string {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#e5e7eb" />
          <stop offset="50%" style="stop-color:#f3f4f6" />
          <stop offset="100%" style="stop-color:#e5e7eb" />
          <animate attributeName="x1" values="-100%;100%" dur="1.5s" repeatCount="indefinite" />
          <animate attributeName="x2" values="0%;200%" dur="1.5s" repeatCount="indefinite" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shimmer)" />
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// ─── URL Transformation ─────────────────────────────────────────────────────────

/**
 * Transform a Supabase Storage URL to use the image transformation API.
 * Adds width, quality, and format parameters for optimised delivery.
 */
function transformSupabaseUrl(src: string, width: number): string {
  // Only transform Supabase URLs
  if (!src.includes('.supabase.co/storage/')) return src;

  const url = new URL(src);

  // Use Supabase image transformation endpoint
  // https://supabase.com/docs/guides/storage/serving/image-transformations
  if (url.pathname.includes('/object/public/')) {
    const transformedPath = url.pathname.replace('/object/public/', '/render/image/public/');
    url.pathname = transformedPath;
  }

  url.searchParams.set('width', String(width));
  url.searchParams.set('quality', '80');

  return url.toString();
}

/**
 * Transform a Cloudinary URL to use optimised delivery parameters.
 */
function transformCloudinaryUrl(src: string, cloudName: string, width: number): string {
  if (!src.includes('res.cloudinary.com')) return src;

  // Insert transformation parameters into Cloudinary URL
  const transformParams = `w_${width},q_auto,f_auto`;
  return src.replace(`/image/upload/`, `/image/upload/${transformParams}/`);
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function OptimizedImage({
  src,
  alt,
  aspect,
  showPlaceholder = true,
  bucket: _bucket,
  cloudinaryCloud,
  containerClassName,
  className,
  priority,
  width: propWidth,
  height: propHeight,
  sizes: propSizes,
  onError,
  ...rest
}: OptimizedImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Resolve dimensions from aspect ratio or props
  const aspectConfig = aspect ? ASPECT_RATIOS[aspect] : null;
  const width = propWidth ?? aspectConfig?.width ?? 800;
  const height = propHeight ?? aspectConfig?.height ?? 600;
  const sizes = propSizes ?? aspectConfig?.sizes ?? '(max-width: 768px) 100vw, 50vw';

  // Transform source URL for optimised delivery
  let resolvedSrc = typeof src === 'string' ? src : src;

  if (typeof resolvedSrc === 'string') {
    const numericWidth = typeof width === 'number' ? width : parseInt(String(width), 10);

    if (resolvedSrc.includes('.supabase.co')) {
      resolvedSrc = transformSupabaseUrl(resolvedSrc, numericWidth);
    } else if (cloudinaryCloud && resolvedSrc.includes('res.cloudinary.com')) {
      resolvedSrc = transformCloudinaryUrl(resolvedSrc, cloudinaryCloud, numericWidth);
    }
  }

  // Generate blur placeholder
  const blurDataURL = showPlaceholder
    ? generateBlurPlaceholder(
        typeof width === 'number' ? width : 800,
        typeof height === 'number' ? height : 600,
      )
    : undefined;

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      setHasError(true);
      setIsLoading(false);
      if (onError) {
        onError(e);
      }
    },
    [onError],
  );

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Error fallback — show a neutral placeholder
  if (hasError) {
    return (
      <div
        className={clsx(
          'flex items-center justify-center bg-gray-100 text-gray-400',
          containerClassName,
        )}
        style={{
          width: typeof width === 'number' ? width : undefined,
          height: typeof height === 'number' ? height : undefined,
          aspectRatio: aspect
            ? `${aspectConfig?.width ?? 4} / ${aspectConfig?.height ?? 3}`
            : undefined,
        }}
        role="img"
        aria-label={alt}
      >
        <svg
          className="h-12 w-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  return (
    <div className={clsx('relative overflow-hidden', containerClassName)}>
      {isLoading && showPlaceholder && (
        <div className="absolute inset-0 animate-pulse bg-gray-200" aria-hidden="true" />
      )}
      <Image
        src={resolvedSrc}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        loading={priority ? undefined : 'lazy'}
        priority={priority}
        placeholder={showPlaceholder ? 'blur' : undefined}
        blurDataURL={blurDataURL}
        className={clsx(
          'transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100',
          className,
        )}
        onLoad={handleLoad}
        onError={handleError}
        {...rest}
      />
    </div>
  );
}
