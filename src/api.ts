import type {
  CompaniesRequest,
  CompaniesResponse,
  LoginRequest,
  ProblemDetail,
  RecordsRequest,
  RecordsResponse,
  TokenResponse,
} from './types';

// Vazio em desenvolvimento (proxy do Vite); em produção aponte VITE_API_URL para a API.
const BASE_URL: string = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'vinculos.accessToken';

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetail;

  constructor(status: number, problem: ProblemDetail) {
    super(problem.detail ?? problem.title ?? `HTTP ${status}`);
    this.status = status;
    this.problem = problem;
  }
}

async function post<T>(path: string, body: unknown, authenticated = true): Promise<T> {
  const token = sessionStorage.getItem(TOKEN_KEY);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, {
      title: 'Erro de rede',
      detail: 'Não foi possível acessar a API. Ela está rodando em http://localhost:8080?',
    });
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({}))) as ProblemDetail;
    if (authenticated && response.status === 401) {
      clearSession();
      window.dispatchEvent(new Event('auth:expired'));
    }
    throw new ApiError(response.status, problem);
  }
  return (await response.json()) as T;
}

export async function login(request: LoginRequest): Promise<TokenResponse> {
  const response = await post<TokenResponse>('/api/v1/auth/token', request, false);
  sessionStorage.setItem(TOKEN_KEY, response.accessToken);
  return response;
}

export function hasSession(): boolean {
  return sessionStorage.getItem(TOKEN_KEY) !== null;
}

export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

/** Endpoint 1: empresas ligadas ao cliente. */
export function findCompanies(request: CompaniesRequest): Promise<CompaniesResponse> {
  return post('/api/v1/customers/companies', request);
}

/** Endpoint 2: registros do cliente por empresa. */
export function findRecords(request: RecordsRequest): Promise<RecordsResponse> {
  return post('/api/v1/customers/records', request);
}
