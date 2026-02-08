import { describe, it, expect } from 'vitest';
import { UserRoleSchema, UserSchema, OfficeSchema, TeamSchema } from './user';

const uuid = () => '00000000-0000-0000-0000-000000000001';
const now = () => new Date().toISOString();

// ─── UserRoleSchema ────────────────────────────────────────────────

describe('UserRoleSchema', () => {
  it('accepts all valid roles', () => {
    for (const role of ['agent', 'principal', 'admin', 'assistant']) {
      expect(UserRoleSchema.parse(role)).toBe(role);
    }
  });

  it('rejects invalid role', () => {
    expect(() => UserRoleSchema.parse('superadmin')).toThrow();
  });
});

// ─── UserSchema ────────────────────────────────────────────────────

describe('UserSchema', () => {
  const validUser = {
    id: uuid(),
    email: 'agent@realflow.com',
    firstName: 'Sarah',
    lastName: 'Johnson',
    role: 'agent' as const,
    createdAt: now(),
    updatedAt: now(),
  };

  it('accepts a valid user with defaults', () => {
    const result = UserSchema.parse(validUser);
    expect(result.isActive).toBe(true);
  });

  it('accepts optional fields', () => {
    const result = UserSchema.parse({
      ...validUser,
      phone: '0400000000',
      avatarUrl: 'https://example.com/avatar.jpg',
      officeId: uuid(),
      teamId: uuid(),
    });
    expect(result.phone).toBe('0400000000');
    expect(result.officeId).toBeDefined();
  });

  it('rejects invalid email', () => {
    expect(() =>
      UserSchema.parse({ ...validUser, email: 'not-email' }),
    ).toThrow();
  });

  it('rejects empty firstName', () => {
    expect(() =>
      UserSchema.parse({ ...validUser, firstName: '' }),
    ).toThrow();
  });
});

// ─── OfficeSchema ──────────────────────────────────────────────────

describe('OfficeSchema', () => {
  it('accepts a valid office', () => {
    const result = OfficeSchema.parse({
      id: uuid(),
      name: 'RealFlow HQ',
      createdAt: now(),
      updatedAt: now(),
    });
    expect(result.name).toBe('RealFlow HQ');
  });

  it('accepts optional fields', () => {
    const result = OfficeSchema.parse({
      id: uuid(),
      name: 'RealFlow HQ',
      address: '100 George St, Sydney NSW 2000',
      phone: '0299990000',
      email: 'office@realflow.com',
      createdAt: now(),
      updatedAt: now(),
    });
    expect(result.email).toBe('office@realflow.com');
  });

  it('rejects empty name', () => {
    expect(() =>
      OfficeSchema.parse({ id: uuid(), name: '', createdAt: now(), updatedAt: now() }),
    ).toThrow();
  });
});

// ─── TeamSchema ────────────────────────────────────────────────────

describe('TeamSchema', () => {
  it('accepts a valid team', () => {
    const result = TeamSchema.parse({
      id: uuid(),
      name: 'Sydney Sales Team',
      officeId: uuid(),
      createdAt: now(),
      updatedAt: now(),
    });
    expect(result.name).toBe('Sydney Sales Team');
  });

  it('accepts optional leadAgentId', () => {
    const result = TeamSchema.parse({
      id: uuid(),
      name: 'Team A',
      officeId: uuid(),
      leadAgentId: uuid(),
      createdAt: now(),
      updatedAt: now(),
    });
    expect(result.leadAgentId).toBeDefined();
  });
});
