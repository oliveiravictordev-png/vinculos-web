# vinculos-web

Front minimalista em **TypeScript** (Vite, sem framework) para consumir a [vinculos-api](https://github.com/oliveiravictordev-png/vinculos-api). Projeto independente da API: build, deploy e versionamento próprios.

Um menu lateral escolhe o endpoint:

| menu | endpoint |
|---|---|
| **Empresas do cliente** | `POST /api/v1/customers/companies` |
| **Registros por empresa** | `POST /api/v1/customers/records` |
| **Busca e exportação** | `POST /api/v1/customers/search` e `/export` |

Atalhos de integração entre os dois:
- No resultado de *Empresas do cliente*, **Ver registros destas empresas** abre o endpoint 2 já com os CNPJs preenchidos.
- Em *Registros por empresa*, **Preencher com as empresas deste cliente** consulta o endpoint 1 e preenche a lista.

Na **Busca e exportação**:
- os filtros são empresa, produto e período (as datas são dias inteiros no horário de Brasília);
- os totais vêm da API e somam o filtro inteiro;
- **Carregar mais** segue o `nextCursor`;
- **Exportar CSV/Excel** baixa até 5.000 linhas e avisa quando o arquivo foi cortado. Os botões só aparecem para quem tem o escopo `customers:export`.

A seção **Últimas consultas** mostra o histórico do usuário (`GET /api/v1/audit/history`), com o documento mascarado.

**Sessão:** o login chama `POST /api/v1/auth/session`, e a API guarda o token só em cookies `HttpOnly`, `Secure` e `SameSite=Strict`. O JavaScript da página nunca vê o token: nada vai para `sessionStorage` ou `localStorage`, então um XSS não consegue roubá-lo. Quando o access token (15 min) vence, `api.ts` chama `/auth/refresh` uma vez e repete a requisição; várias chamadas simultâneas esperam o mesmo refresh. **Sair** chama `/auth/logout`, que revoga a sessão na API.

Erros da API (RFC 9457) aparecem com um título em português pelo status (400, 401, 403, 429, 503) e o `detail` devolvido pela API, traduzido em `messages.ts`.

## Como rodar

Pré-requisitos: **Node.js 20.19+ ou 22.12+** e a vinculos-api rodando em `http://localhost:8080`.

```bash
npm install
npm run dev        # http://localhost:5173
```

Em desenvolvimento o Vite repassa `/api` para `localhost:8080` (`vite.config.ts`), então a API não precisa de CORS.

## Vercel

O `vercel.json` repassa `/api/*` para a API publicada na VPS (`https://vinculos.212-28-185-69.sslip.io`). O navegador só fala com o domínio da Vercel, então também não há CORS, e os cookies da sessão são da mesma origem (o `SameSite=Strict` depende disso). Para apontar para outra API, troque o `destination`.

## Docker

```bash
docker build -t vinculos-web .
docker run -p 8081:80 -e API_URL=http://host.docker.internal:8080 vinculos-web   # http://localhost:8081
```

O nginx serve o build e repassa `/api` para `API_URL`. Em um compose ou cluster, aponte `API_URL` para o serviço da API (ex.: `http://vinculos-api:8080`).

## Estrutura

```
src/
├── types.ts    espelho dos records DTO da API
├── api.ts      cliente HTTP (fetch) e ApiError
├── main.ts     menu, formulário e renderização dos resultados
└── style.css   tema claro/escuro
public/gft-logo.svg                  logo da GFT (provisória: substitua pelo SVG oficial com o mesmo nome)
public/partners/bradesco-logo.svg    logo do Bradesco na seção Parceiros (provisória)
public/partners/bradesco-mascote.svg mascote do Bradesco na seção Parceiros (provisório; para PNG, ajuste o src no index.html)
```

Convenção: código e nomes em inglês; textos da interface e comentários em português.
