import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth, requireOwner, requireAdmin } from '../../server/middleware/auth.js';

function makeReq(session: Record<string, unknown> = {}): Partial<Request> {
  return { session: { ...session, regenerate: vi.fn(), destroy: vi.fn(), reload: vi.fn(), save: vi.fn(), touch: vi.fn(), resetMaxAge: vi.fn(), id: 'sid', cookie: {} as never } } as Partial<Request>;
}

function makeRes(): { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>; statusCode?: number } {
  const res: Record<string, unknown> = {};
  res.json = vi.fn().mockReturnThis();
  res.status = vi.fn().mockReturnValue(res);
  return res as ReturnType<typeof makeRes>;
}

describe('requireAuth', () => {
  it('rejects unauthenticated requests', () => {
    const req = makeReq() as Request;
    const res = makeRes() as unknown as Response;
    const next = vi.fn() as NextFunction;
    requireAuth(req, res, next);
    expect((res.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects totpPending requests', () => {
    const req = makeReq({ userId: 'u1', totpPending: true }) as Request;
    const res = makeRes() as unknown as Response;
    const next = vi.fn() as NextFunction;
    requireAuth(req, res, next);
    expect((res.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes authenticated requests', () => {
    const req = makeReq({ userId: 'u1', totpPending: false }) as Request;
    const res = makeRes() as unknown as Response;
    const next = vi.fn() as NextFunction;
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireOwner', () => {
  it('rejects non-owners', () => {
    const req = { householdRole: 'member' } as Request;
    const res = makeRes() as unknown as Response;
    const next = vi.fn() as NextFunction;
    requireOwner(req, res, next);
    expect((res.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(403);
  });

  it('passes owners', () => {
    const req = { householdRole: 'owner' } as Request;
    const res = makeRes() as unknown as Response;
    const next = vi.fn() as NextFunction;
    requireOwner(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  it('rejects non-admins', () => {
    const req = { systemRole: 'user' } as Request;
    const res = makeRes() as unknown as Response;
    const next = vi.fn() as NextFunction;
    requireAdmin(req, res, next);
    expect((res.status as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(403);
  });

  it('passes admins', () => {
    const req = { systemRole: 'admin' } as Request;
    const res = makeRes() as unknown as Response;
    const next = vi.fn() as NextFunction;
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
