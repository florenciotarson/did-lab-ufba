// app/api/exportar/route.js // <-- Mantido como .js
import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server'; // Imports continuam funcionando

// Função log sem tipagem TS
function log(message) { 
    console.log(`[API Exportar] ${new Date().toISOString()}: ${message}`); 
}

// Usaremos GET para facilitar o download via link no frontend
export async function GET(request) { // Removida a tipagem : NextRequest
    try {
        // Pegar o endereço do usuário do query parameter
        const { searchParams } = new URL(request.url);
        const userAddress = searchParams.get('userAddress');

        log(`Recebida requisicao para exportar dados do usuario: ${userAddress}`);

        if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) { // Validação simples de endereço Ethereum
            log("Erro: Endereco do usuario invalido ou ausente.");
            return NextResponse.json({ message: 'Endereço do usuário inválido ou ausente.' }, { status: 400 });
        }

        // --- BUSCA NO BANCO DE DADOS ---
        log(`Buscando credenciais no DB para: ${userAddress}`);
        const credenciaisDoUsuario = await prisma.credencial.findMany({
            where: {
                usuarioAddress: {
                    equals: userAddress,
                    mode: 'insensitive' // Garante case-insensitivity se necessário
                 }
             },
            select: { // Seleciona apenas os campos necessários para o backup
                id: true,
                emissorAddress: true,
                hashVerificacao: true,
                nomeAmigavel: true,
                descricao: true,
                blobCriptografado: true, // O dado "secreto"
                createdAt: true,
                updatedAt: true,
            }
        });
        log(`Encontradas ${credenciaisDoUsuario.length} credenciais.`);

        // --- FORMATAR O JSON DE BACKUP ---
        const backupData = {
            didLabExportVersion: "1.0",
            exportDate: new Date().toISOString(),
            usuarioAddress: userAddress, // userAddress já é string ou null, validado acima
            credenciais: credenciaisDoUsuario,
        };

        // --- PREPARAR RESPOSTA PARA DOWNLOAD ---
        const jsonString = JSON.stringify(backupData, null, 2); // Formata com indentação
        // Removida a asserção de tipo 'as string', pois já validamos que userAddress não é null
        const fileName = `did_lab_backup_${userAddress.substring(0, 6)}_${Date.now()}.json`;

        log(`Preparando download do arquivo: ${fileName}`);

        return new NextResponse(jsonString, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="${fileName}"`, // Força o download
            },
        });

    } catch (error) { // Removida a tipagem : any
        // Acessa a mensagem de erro de forma segura em JS
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`ERRO: ${errorMessage}`);
        console.error("Erro detalhado na exportacao:", error);
        return NextResponse.json({ message: 'Erro interno no servidor ao exportar dados.', details: errorMessage }, { status: 500 });
    } finally {
        // Garante desconexão do Prisma
        try {
            await prisma.$disconnect();
        } catch (disconnectError) {
             console.error("Erro ao desconectar Prisma:", disconnectError);
        }
    }
}