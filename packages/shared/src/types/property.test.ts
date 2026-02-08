import { describe, it, expect } from 'vitest';
import {
  PropertyPhotoSchema,
  ComparableSaleSchema,
  PropertySchema,
  CreatePropertySchema,
  UpdatePropertySchema,
} from './property';

const uuid = () => '00000000-0000-0000-0000-000000000001';
const now = () => new Date().toISOString();

const validAddress = {
  streetNumber: '10',
  streetName: 'Collins St',
  suburb: 'Melbourne',
  state: 'VIC' as const,
  postcode: '3000',
};

// ─── PropertyPhotoSchema ───────────────────────────────────────────

describe('PropertyPhotoSchema', () => {
  it('accepts a valid photo', () => {
    const result = PropertyPhotoSchema.parse({
      id: uuid(),
      url: 'https://example.com/photo.jpg',
      sortOrder: 0,
    });
    expect(result.isPrimary).toBe(false);
  });

  it('accepts optional caption and isPrimary override', () => {
    const result = PropertyPhotoSchema.parse({
      id: uuid(),
      url: 'https://example.com/photo.jpg',
      caption: 'Front view',
      sortOrder: 1,
      isPrimary: true,
    });
    expect(result.caption).toBe('Front view');
    expect(result.isPrimary).toBe(true);
  });

  it('rejects invalid URL', () => {
    expect(() =>
      PropertyPhotoSchema.parse({
        id: uuid(),
        url: 'not-a-url',
        sortOrder: 0,
      }),
    ).toThrow();
  });

  it('rejects negative sortOrder', () => {
    expect(() =>
      PropertyPhotoSchema.parse({
        id: uuid(),
        url: 'https://example.com/photo.jpg',
        sortOrder: -1,
      }),
    ).toThrow();
  });
});

// ─── ComparableSaleSchema ──────────────────────────────────────────

describe('ComparableSaleSchema', () => {
  it('accepts a valid comparable sale', () => {
    const result = ComparableSaleSchema.parse({
      address: '5 George St, Sydney NSW 2000',
      salePrice: 1200000,
      saleDate: now(),
      bedrooms: 3,
      bathrooms: 2,
      carSpaces: 1,
      propertyType: 'house',
    });
    expect(result.salePrice).toBe(1200000);
  });

  it('rejects negative sale price', () => {
    expect(() =>
      ComparableSaleSchema.parse({
        address: '5 George St',
        salePrice: -100,
        saleDate: now(),
        bedrooms: 3,
        bathrooms: 2,
        carSpaces: 1,
        propertyType: 'house',
      }),
    ).toThrow();
  });

  it('accepts zero for bedrooms/bathrooms/carSpaces', () => {
    const result = ComparableSaleSchema.parse({
      address: '5 George St',
      salePrice: 500000,
      saleDate: now(),
      bedrooms: 0,
      bathrooms: 0,
      carSpaces: 0,
      propertyType: 'land',
    });
    expect(result.bedrooms).toBe(0);
  });
});

// ─── PropertySchema ────────────────────────────────────────────────

describe('PropertySchema', () => {
  const validProperty = {
    id: uuid(),
    address: validAddress,
    propertyType: 'house' as const,
    bedrooms: 4,
    bathrooms: 2,
    carSpaces: 2,
    saleType: 'private-treaty' as const,
    photos: [],
    floorPlans: [],
    interestedBuyerIds: [],
    assignedAgentId: uuid(),
    comparables: [],
    createdAt: now(),
    updatedAt: now(),
  };

  it('accepts a minimal valid property', () => {
    const result = PropertySchema.parse(validProperty);
    expect(result.propertyType).toBe('house');
    expect(result.listingStatus).toBe('pre-market');
    expect(result.portalViews).toBe(0);
  });

  it('defaults analytics counters to 0', () => {
    const result = PropertySchema.parse(validProperty);
    expect(result.portalViews).toBe(0);
    expect(result.enquiryCount).toBe(0);
    expect(result.inspectionCount).toBe(0);
  });

  it('accepts optional listing details', () => {
    const result = PropertySchema.parse({
      ...validProperty,
      listPrice: 950000,
      priceGuide: '$900k - $1M',
      auctionDate: now(),
      domainListingId: 'DOM123',
      reaListingId: 'REA456',
    });
    expect(result.listPrice).toBe(950000);
    expect(result.priceGuide).toBe('$900k - $1M');
  });

  it('accepts optional media fields', () => {
    const result = PropertySchema.parse({
      ...validProperty,
      virtualTourUrl: 'https://tour.example.com/123',
      videoUrl: 'https://video.example.com/456',
    });
    expect(result.virtualTourUrl).toBeDefined();
    expect(result.videoUrl).toBeDefined();
  });

  it('rejects negative bedrooms', () => {
    expect(() =>
      PropertySchema.parse({ ...validProperty, bedrooms: -1 }),
    ).toThrow();
  });
});

// ─── CreatePropertySchema ──────────────────────────────────────────

describe('CreatePropertySchema', () => {
  it('omits id, createdAt, updatedAt, analytics counters', () => {
    const result = CreatePropertySchema.parse({
      address: validAddress,
      propertyType: 'apartment',
      bedrooms: 2,
      bathrooms: 1,
      carSpaces: 1,
      saleType: 'auction',
      assignedAgentId: uuid(),
    });
    expect(result.propertyType).toBe('apartment');
    expect((result as Record<string, unknown>).id).toBeUndefined();
  });

  it('makes photos, floorPlans, interestedBuyerIds, comparables optional', () => {
    const result = CreatePropertySchema.parse({
      address: validAddress,
      propertyType: 'unit',
      bedrooms: 1,
      bathrooms: 1,
      carSpaces: 0,
      saleType: 'private-treaty',
      assignedAgentId: uuid(),
    });
    expect(result.photos).toBeUndefined();
    expect(result.floorPlans).toBeUndefined();
  });
});

// ─── UpdatePropertySchema ──────────────────────────────────────────

describe('UpdatePropertySchema', () => {
  it('accepts partial updates', () => {
    const result = UpdatePropertySchema.parse({ bedrooms: 5 });
    expect(result.bedrooms).toBe(5);
  });

  it('accepts an empty object', () => {
    const result = UpdatePropertySchema.parse({});
    expect(result).toEqual({});
  });
});
