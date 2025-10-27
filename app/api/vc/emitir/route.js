// app/api/vc/emitir/route.js
import { NextResponse } from 'next/server';
import { EthrDID } from 'ethr-did';
import { createVerifiableCredentialJwt } from 'did-jwt-vc';
import { Resolver } from 'did-resolver';
import { getResolver as ethrGetResolver } from 'ethr-did-resolver';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variável de ambiente ausente: ${name}`);
  return v;
}
function log(m) {
  console.log(`[API VC/emitir] ${new Date().toISOString()}: ${m}`);
}

// constrói um DID resolver para a rede configurada (ex.: sepolia)
function buildResolver() {
  const rpcUrl = requireEnv('NEXT_PUBLIC_SEPOLIA_RPC_URL');
  const network = process.env.NEXT_PUBLIC_DID_NETWORK || 'sepolia';
  const ethrResolver = ethrGetResolver({
    networks: [{ name: network, rpcUrl }],
  });
  return new Resolver(ethrResolver);
}

export async function POST(req) {
  try {
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      return NextResponse.json({ message: 'Content-Type deve ser application/json' }, { status: 415 });
    }

    const { subjectAddress, claims, expirationSeconds = 60 * 60 * 24 * 180 } = await req.json() || {};
    if (!subjectAddress || typeof subjectAddress !== 'string') {
      return NextResponse.json({ message: 'subjectAddress é obrigatório (endereço 0x...)' }, { status: 400 });
    }
    if (!claims || typeof claims !== 'object') {
      return NextResponse.json({ message: 'claims (objeto JSON) é obrigatório' }, { status: 400 });
    }

    // configura emissor como did:ethr
    const privateKey = requireEnv('EMISSOR_PRIVATE_KEY').replace(/^0x/, '');
    const network = process.env.NEXT_PUBLIC_DID_NETWORK || 'sepolia';
    const issuer = new EthrDID({
      privateKey,
      chainName: network, // 'sepolia'
      rpcUrl: requireEnv('NEXT_PUBLIC_SEPOLIA_RPC_URL'),
    });

    const now = Math.floor(Date.now() / 1000);
    const exp = now + Number(expirationSeconds);

    // VC “EnrollmentStatusCredential” (exemplo)
    const vcPayload = {
      sub: `did:ethr:${network}:${subjectAddress}`,   // subject DID
      nbf: now - 5,
      exp,
      vc: {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'EnrollmentStatusCredential'],
        credentialSubject: {
          id: `did:ethr:${network}:${subjectAddress}`,
          ...claims, // ex.: { status: 'ATIVO', curso: 'PGCOMP' }
        },
      },
    };

    const resolver = buildResolver();

    // assina VC no formato JWT
    const jwt = await createVerifiableCredentialJwt(vcPayload, issuer, { resolver });

    log(`VC emitida para ${subjectAddress} (len=${jwt.length})`);
    return NextResponse.json(
      { format: 'vc-jwt', issuer: issuer.did, jwt },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: 'Erro ao emitir VC', details: error.message },
      { status: 500 }
    );
  }
}
