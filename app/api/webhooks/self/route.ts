import { NextResponse } from 'next/server';
import { AllIds, DefaultConfigStore, SelfBackendVerifier, type AttestationId } from '@selfxyz/core';
import { SelfWebhooks } from '@selfxyz/enterprise-sdk';
import { markIdentityVerified } from '@/lib/identity-verify';
import { selfCredentials, verificationDecision } from '@/lib/self-enterprise';
import {
  SELF_LEGACY_SCOPE,
  legacyProofDecision,
  selfLegacyEndpoint,
  selfLegacyMode,
} from '@/lib/self-legacy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const verifiers = new Map<string, SelfBackendVerifier>();

function verifierFor(endpoint: string, mockPassport: boolean) {
  const key = `${mockPassport ? 'mock' : 'real'}:${endpoint}`;
  const existing = verifiers.get(key);
  if (existing) return existing;
  const created = new SelfBackendVerifier(
    SELF_LEGACY_SCOPE,
    endpoint,
    mockPassport,
    AllIds,
    new DefaultConfigStore({}),
    'uuid',
  );
  verifiers.set(key, created);
  return created;
}

function legacyResponse(ok: boolean, reason?: string, status = 200) {
  return NextResponse.json(ok ? { status: 'success', result: true } : { status: 'error', result: false, reason: reason || 'Verification failed' }, { status });
}

function attestationId(value: unknown): AttestationId | null {
  const id = Number(value);
  if (id === 1 || id === 2 || id === 3 || id === 4) return id;
  return null;
}

function isLegacyProof(body: unknown): body is { attestationId: unknown; proof: unknown; publicSignals: unknown; userContextData: unknown } {
  if (!body || typeof body !== 'object') return false;
  const record = body as Record<string, unknown>;
  return record.proof != null && Array.isArray(record.publicSignals) && typeof record.userContextData === 'string';
}

async function verifyLegacy(body: { attestationId: unknown; proof: unknown; publicSignals: unknown; userContextData: unknown }) {
  const secret = process.env.BETTER_AUTH_SECRET?.trim() ?? '';
  const id = attestationId(body.attestationId);
  if (!id || !body.proof || typeof body.proof !== 'object' || !Array.isArray(body.publicSignals) || typeof body.userContextData !== 'string') {
    return legacyResponse(false, 'Proof is incomplete.');
  }
  if (secret.length < 16) return legacyResponse(false, 'Verification is not configured.', 503);
  const endpoint = selfLegacyEndpoint(process.env);
  const mockPassport = selfLegacyMode(process.env) === 'mock';
  try {
    const result = await verifierFor(endpoint, mockPassport).verify(
      id,
      body.proof as { a: [string, string]; b: [[string, string], [string, string]]; c: [string, string] },
      body.publicSignals as string[],
      body.userContextData,
    );
    const decision = legacyProofDecision({
      isValid: result.isValidDetails.isValid,
      userIdentifier: result.userData.userIdentifier,
      userDefinedData: result.userData.userDefinedData,
      nullifier: result.discloseOutput.nullifier,
    }, secret);
    if (!decision) return legacyResponse(false, 'Verification did not match this account.');
    const marked = await markIdentityVerified(decision.userId, decision.nullifier);
    if (marked === 'already' || marked === 'marked') return legacyResponse(true);
    if (marked === 'duplicate') return legacyResponse(false, 'This document is already used on another DEVCITY account.');
    return legacyResponse(false, 'Verification did not match a DEVCITY account.');
  } catch (error) {
    console.error('Self legacy verification failed', error instanceof Error ? error.name : 'error');
    return legacyResponse(false, 'Verification failed.');
  }
}

export async function POST(request: Request) {
  const raw = await request.text();
  const headers = Object.fromEntries(request.headers);
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }

  if (!headers['svix-signature'] && isLegacyProof(body)) {
    return verifyLegacy(body);
  }

  const creds = selfCredentials(process.env);
  if (!creds.webhookSecret || !creds.flowId) {
    return NextResponse.json({ error: 'Self webhook is not configured.' }, { status: 503 });
  }
  let event;
  try {
    event = SelfWebhooks.verify(raw, headers, creds.webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }
  if (event.type !== 'verification.completed') {
    return NextResponse.json({ ok: true });
  }
  const decision = verificationDecision(event, { mode: creds.mode, flowId: creds.flowId });
  if (decision === 'mark') {
    const nullifier = typeof event.nullifier === 'string' ? event.nullifier : null;
    await markIdentityVerified(event.external_uuid, nullifier);
  }
  return NextResponse.json({ ok: true });
}
