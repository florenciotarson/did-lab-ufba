// app/api/exportar/route.js
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

// ---------- helpers ----------
function log(message) {
  console.log(`[API Exportar] ${new Date().toISOString()}: ${message}`);
}

// API key opcional: se API_EXPORT_KEY estiver definida, exigir header x-api-key igual.
function checkApiKey(req) {
  const required = process.env.API_EXPORT_KEY;
  if (!required) return; // desabilitado
  const got = req.headers.get('x-api-key');
  if (got !== required) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
}

// ---------- handler (GET) ----------
export async function GET(request) {
  try {
    checkApiKey(request);

    // Pega userAddress do querystring
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');

    if (!userAddress || !ethers.utils.isAddress(userAddress)) {
      log('Erro: endereco do usuario invalido ou ausente.');
      return NextResponse.json(
        { message: 'Endereço do usuário inválido ou ausente.' },
        { status: 400 }
      );
    }

    // Normaliza para minúsculas para consulta consistente
    const addr = userAddress.toLowerCase();
    log(`Exportacao solicitada para: ${addr}`);

    // --- BUSCA NO BANCO ---
    const credenciaisDoUsuario = await prisma.credencial.findMany({
      where: { usuarioAddress: addr },
      select: {
        id: true,
        emissorAddress: true,
        hashVerificacao: true,
        nomeAmigavel: true,
        descricao: true,
        blobCriptografado: true, // dado do usuário (ciphertext na versão segura)
        createdAt: true,
        updatedAt: true,
        // Se você tiver o campo abaixo no schema, pode habilitar:
        // revogadaEm: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    log(`Encontradas ${credenciaisDoUsuario.length} credenciais.`);

    // --- MONTA O BACKUP ---
    const backupData = {
      didLabExportVersion: '1.0',
      exportDate: new Date().toISOString(),
      usuarioAddress: userAddress, // forma fornecida pelo usuário
      usuarioAddressNormalized: addr,
      total: credenciaisDoUsuario.length,
      credenciais: credenciaisDoUsuario,
      note:
        credenciaisDoUsuario.length === 0
          ? 'Nenhuma credencial encontrada para este endereço.'
          : undefined,
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const safePrefix = addr.slice(0, 6);
    const fileName = `did_lab_backup_${safePrefix}_${Date.now()}.json`;
    log(`Preparando download: ${fileName}`);

    // --- RESPOSTA PARA DOWNLOAD ---
    return new NextResponse(jsonString, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const status = error.statusCode || 500;
    log(`ERRO: ${errorMessage}`);
    console.error('Erro detalhado na exportacao:', error);
    return NextResponse.json(
      { message: 'Erro interno no servidor ao exportar dados.', details: errorMessage },
      { status }
    );
  }
  // Importante: NÃO chamar prisma.$disconnect() em serverless (singleton cuida do ciclo de vida)
}
