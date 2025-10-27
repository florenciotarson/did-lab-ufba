// app/api/vc/verificar/route.js
import { NextResponse } from 'next/server';
import { verifyCredential } from 'did-jwt-vc';
import { Resolver } from 'did-resolver';
import { getResolver as ethrGetResolver } from 'ethr-did-resolver';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}

function buildResolver() {
  const rpcUrl = requireEnv('NEXT_PUBLIC_SEPOLIA_RPC_URL');
  const network = process.env.NEXT_PUBLIC_DID_NETWORK || 'sepolia';
  const ethrResolver = ethrGetResolver({
    networks: [{ name: network, rpcUrl }],
  });
  return new Resolver(ethrResolver);
}

function log(m) {
  console.log(`[API VC/verificar] ${new Date().toISOString()}: ${m}`);
}

export async function POST(req) {
  try {
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return NextResponse.json({ message: 'Content-Type deve ser application/json' }, { status: 415 });
    }

    const { jwt } = await req.json() || {};
    if (!jwt || typeof jwt !== 'string') {
      return NextResponse.json({ message: 'jwt é obrigatório (VC-JWT)' }, { status: 400 });
    }

    const resolver = buildResolver();
    const result = await verifyCredential(jwt, resolver);

    // result.verifiableCredential: VC normalizada
    // result.payload: payload do JWT (iss, sub, nbf, exp, etc.)
    // result.verified: boolean
    log(`VC verificada (verified=${result.verified})`);

    return NextResponse.json(
      {
        verified: result.verified,
        issuer: result.verifiableCredential?.issuer?.id || result.payload?.iss,
        subject: result.verifiableCredential?.credentialSubject?.id || result.payload?.sub,
        types: result.verifiableCredential?.type,
        payload: result.payload,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[VC/verificar] erro:', error);
    return NextResponse.json(
      { message: 'Falha na verificação da VC', details: error.message },
      { status: 400 }
    );
  }
}
