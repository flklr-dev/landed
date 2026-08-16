// ─────────────────────────────────────────────────────────────────────────────
// Landed — API Client Wrapper
// Unified client for communicating with the Express API (apps/api).
// Supports token injection, structured error handling, and JSON parsing.
// ─────────────────────────────────────────────────────────────────────────────

import type { Job, JobStatus, User } from '@landed/shared-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Get stored auth token from localStorage */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('landed_token');
}

/** Set auth token in localStorage */
export function setToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('landed_token', token);
  }
}

/** Clear auth token from localStorage */
export function clearToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('landed_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    let details: Record<string, unknown> | undefined;

    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
      details = data.details;
    } catch {
      errorMessage = response.statusText;
    }

    throw new ApiError(response.status, errorMessage, details);
  }

  return response.json();
}

// ── Auth endpoints ───────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<{ user: User; token: string }> {
  const result = await request<{ user: User; token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(result.token);
  return result;
}

export async function register(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
  const result = await request<{ user: User; token: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  setToken(result.token);
  return result;
}

export async function googleAuth(credential: string): Promise<{ user: User; token: string; isNew: boolean }> {
  const result = await request<{ user: User; token: string; isNew: boolean }>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
  setToken(result.token);
  return result;
}

export async function getMe(): Promise<{ user: User }> {
  return request<{ user: User }>('/auth/me');
}

// ── Job endpoints ────────────────────────────────────────────────────────────

export interface ListJobsOptions {
  status?: JobStatus;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface ListJobsResponse {
  jobs: Job[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function fetchJobs(options: ListJobsOptions = {}): Promise<ListJobsResponse> {
  const params = new URLSearchParams();
  if (options.status) params.set('status', options.status);
  if (options.page) params.set('page', options.page.toString());
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.sort) params.set('sort', options.sort);
  if (options.order) params.set('order', options.order);

  const queryString = params.toString() ? `?${params.toString()}` : '';
  return request<ListJobsResponse>(`/jobs${queryString}`);
}

export async function createJob(jobData: Partial<Job>): Promise<{ job: Job }> {
  return request<{ job: Job }>('/jobs', {
    method: 'POST',
    body: JSON.stringify(jobData),
  });
}

export async function extractJobFromUrl(url: string): Promise<{ job: Job; message: string }> {
  return request<{ job: Job; message: string }>('/jobs/extract', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function extractJobLive(url: string): Promise<{
  success: boolean;
  data: {
    company: string;
    title: string;
    location?: string | null;
    salaryRaw?: string | null;
    remoteType?: 'remote' | 'hybrid' | 'onsite' | null;
    jobType?: 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship' | null;
    experienceLevel?: string | null;
    requiredSkills: string[];
    description?: string | null;
    sourceUrl: string;
  };
}> {
  return request('/jobs/extract-live', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export async function updateJob(id: string, updates: Partial<Job>): Promise<{ job: Job }> {
  return request<{ job: Job }>(`/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function deleteJob(id: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/jobs/${id}`, {
    method: 'DELETE',
  });
}

// ── Match endpoints ──────────────────────────────────────────────────────────

export async function fetchMatches(): Promise<{ matches: Array<{ score: number; job: Job }>; hasResume: boolean }> {
  return request('/matches');
}
