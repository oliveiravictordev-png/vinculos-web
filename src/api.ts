import type {
  CompaniesRequest,
  CompaniesResponse,
  ExportResult,
  HistoryResponse,
  LoginRequest,
  ProblemDetail,
  RecordsRequest,
  RecordsResponse,
  SearchRequest,
  SearchResponse,
  SessionResponse,
} from './types';

// Vazio em desenvolvimento (proxy do Vite) e na Vercel (rewrite de /api): o navegador vê uma única origem, então os
// cookies da sessão (SameSite=Strict) são enviados sem CORS.
const BASE_URL: string = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetail;

  constructor(status: number, problem: ProblemDetail) {
    super(problem.detail ?? problem.title ?? `HTTP ${status}`);
    this.status = status;
    this.problem = problem;
  }
}

// Várias chamadas podem receber 401 ao mesmo tempo quando o access token vence: todas esperam o mesmo refresh.
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${BASE_URL}/api/v1/auth/refresh`, { method: 'POST', credentials: 'same-origin' })
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/**
 * Faz a chamada com os cookies da sessão. Num 401 tenta renovar a sessão uma vez e repete; se não der, avisa a
 * página (auth:expired) para voltar ao login.
 */
async function send(path: string, init: RequestInit, authenticated = true): Promise<Response> {
  const call = () =>
    fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...init.headers },
    });
  let response: Response;
  try {
    response = await call();
    if (authenticated && response.status === 401 && (await refreshSession())) {
      response = await call();
    }
  } catch {
    throw new ApiError(0, {
      title: 'Erro de rede',
      detail: 'Não foi possível acessar a API. Verifique a conexão e tente novamente.',
    });
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as ProblemDetail;
    if (authenticated && response.status === 401) {
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw new ApiError(response.status, problem);
  }
  return response;
}

async function post<T>(path: string, body: unknown, authenticated = true): Promise<T> {
  const response = await send(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, authenticated);
  return (await response.json()) as T;
}

/** Login do navegador: a API grava a sessão em cookies HttpOnly; o corpo não traz token. */
export function login(request: LoginRequest): Promise<SessionResponse> {
  return post<SessionResponse>('/api/v1/auth/session', request, false);
}

/** Sessão atual, ou null se não houver (sem disparar auth:expired: é o carregamento da página). */
export async function currentSession(retry = true): Promise<SessionResponse | null> {
  try {
    const response = await send('/api/v1/auth/session', { method: 'GET' }, false);
    return (await response.json()) as SessionResponse;
  } catch {
    // Access token vencido com refresh ainda válido (ex.: página reaberta depois de 15 min): renova uma vez.
    return retry && (await refreshSession()) ? currentSession(false) : null;
  }
}

export async function logout(): Promise<void> {
  await fetch(`${BASE_URL}/api/v1/auth/logout`, { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
}

/** Endpoint 1: empresas ligadas ao cliente. */
export function findCompanies(request: CompaniesRequest): Promise<CompaniesResponse> {
  return post('/api/v1/customers/companies', request);
}

/** Endpoint 2: registros do cliente por empresa. */
export function findRecords(request: RecordsRequest): Promise<RecordsResponse> {
  return post('/api/v1/customers/records', request);
}

/** Busca paginada: repita com cursor = nextCursor para a próxima página. */
export function searchRecords(request: SearchRequest): Promise<SearchResponse> {
  return post('/api/v1/customers/search', request);
}

export async function fetchHistory(limit = 10): Promise<HistoryResponse> {
  const response = await send(`/api/v1/audit/history?limit=${limit}`, { method: 'GET' });
  return (await response.json()) as HistoryResponse;
}

/** Baixa a exportação (até 5.000 linhas) e avisa se o arquivo veio cortado. */
export async function exportRecords(request: SearchRequest, format: 'csv' | 'xlsx'): Promise<ExportResult> {
  const response = await send(`/api/v1/customers/export?format=${format}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `vinculos.${format}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { truncated: response.headers.get('X-Export-Truncated') === 'true' };
}
