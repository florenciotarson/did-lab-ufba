# Lab de Identidade Soberana (DID/SSI) - PoC PGCOMP/UFBA 🇧🇷

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Status: PoC](https://img.shields.io/badge/status-Prova%20de%20Conceito-brightgreen)](https://github.com/florenciotarson/did-lab-ufba)
[![Blockchain: Sepolia](https://img.shields.io/badge/Blockchain-Sepolia%20Testnet-purple)](https://sepolia.etherscan.io/)

**Prova de Conceito de Identidade Descentralizada (DID/SSI) desenvolvida para o processo seletivo do Mestrado do PGCOMP/UFBA (Edital 10/2025).**

**Lab Online:** [**https://did.oxecollective.com**](https://did.oxecollective.com)

## Motivação

Explorar uma alternativa ao modelo centralizado de identidade digital (OAuth, SAML, etc.), focando em:
* **Soberania do Usuário:** Controle total sobre os próprios dados.
* **Privacidade (Zero-Knowledge):** Provar fatos sem revelar dados sensíveis.
* **Segurança:** Eliminar pontos únicos de falha.
* **Inclusão Digital:** Padrões abertos e gratuitos.
* **Alinhamento:** LGPD e iniciativas de soberania digital (RNP).

## Conceito Central: "Cartório" vs. "Cofre"

* **Blockchain (Sepolia):** Atua como "Cartório" público, registrando apenas **hashes** (provas) via Smart Contract (`IdentidadeDID.sol`).
* **Banco de Dados (Neon/Postgres):** Atua como "Cofre" privado, armazenando **blobs criptografados** (dados) + metadados. *A plataforma não lê os dados do usuário.*

## Funcionalidades

* Emissão de Credenciais (Hash on-chain, Blob off-chain)
* Verificação Zero-Knowledge (Consulta `true`/`false` on-chain)
* Revogação pelo Usuário (On-chain)
* Soberania via Backup/Exportação (JSON com blobs criptografados - *a implementar*)

## Stack Tecnológica

* **Blockchain:** Solidity, Sepolia, MetaMask, Ethers.js
* **Backend:** Vercel Serverless Functions (Node.js)
* **Frontend:** Vercel (Next.js/React/Tailwind)
* **Banco de Dados:** Neon Postgres + Prisma
* **Infra:** Alchemy (RPC), Cloudflare (DNS)

## Como Rodar Localmente

1.  **Clone:** `git clone https://github.com/florenciotarson/did-lab-ufba.git && cd did-lab-ufba`
2.  **Instale:** `npm install && npm install ethers`
3.  **Contrato:** Implante `/contracts/IdentidadeDID.sol` na Sepolia via [Remix IDE](https://remix.ethereum.org/).
4.  **Configure `.env.development.local`:** Copie `.env.example` (se existir) ou crie o arquivo. Adicione as chaves:
    * `POSTGRES_...` (Use `vercel env pull` após conectar Vercel + Neon)
    * `NEXT_PUBLIC_SEPOLIA_RPC_URL` (Da Alchemy)
    * `EMISSOR_PRIVATE_KEY` (De uma carteira Sepolia com ETH de teste)
    * `NEXT_PUBLIC_CONTRATO_ENDERECO` (Do deploy do contrato)
5.  **Banco (Primeira vez):** `npx dotenv -e .env.development.local -- npx prisma migrate dev --name init`
6.  **Rode:** `npm run dev` (Acesse `http://localhost:3000`)

## Autor

* **Tarson Marcelo Florêncio Santos**
* [LinkedIn](https://www.linkedin.com/in/tarsonmarceloflorencio) | [GitHub](https://github.com/florenciotarson)
