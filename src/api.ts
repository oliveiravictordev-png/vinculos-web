import type {
  CompaniesRequest,
  CompaniesResponse,
  ProblemDetail,
  RecordsRequest,
  RecordsResponse,
} from './types';

// Vazio em desenvolvimento (proxy do Vite); em produção aponte VITE_API_URL para a API.
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

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
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
    throw new ApiError(response.status, problem);
  }
  return (await response.json()) as T;
}

/** Endpoint 1: empresas ligadas ao cliente. */
export function findCompanies(request: CompaniesRequest): Promise<CompaniesResponse> {
  return post('/api/v1/customers/companies', request);
}

/** Endpoint 2: registros do cliente por empresa. */
export function findRecords(request: RecordsRequest): Promise<RecordsResponse> {
  return post('/api/v1/customers/records', request);
}
