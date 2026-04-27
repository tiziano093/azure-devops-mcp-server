import * as azdev from "azure-devops-node-api";

import { ResponseCache } from "./cache.js";

export type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export interface AdoConfig {
  organization: string;
  organizationUrl: string;
  defaultProject?: string;
  pat: string;
  apiVersion: string;
  cacheTtlSeconds: number;
  cacheMaxSize: number;
}

export interface AdoRequestOptions {
  project?: string | null;
  routePrefix?: string | null;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
  apiVersion?: string | null;
  retries?: number;
  /** Skip the response cache for this request. */
  noCache?: boolean;
}

export interface AdoResponse<T> {
  data: T;
  continuationToken?: string;
  headers: Record<string, string>;
}

export class AdoApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
    public readonly url: string
  ) {
    super(`Azure DevOps API ${status} ${statusText}`);
  }

  toUserMessage(): string {
    const hint = this.hint();
    const body = this.body ? `\nBody: ${trimForDisplay(this.body, 1800)}` : "";
    return `${this.message}. ${hint}\nURL: ${this.url}${body}`;
  }

  private hint(): string {
    if (this.status === 401) {
      return "PAT invalid, expired, or missing required scopes.";
    }
    if (this.status === 403) {
      return "PAT is valid but lacks permission for this organization, project, or resource.";
    }
    if (this.status === 404) {
      return "Resource not found. Check project, team, repository, pipeline, or ID.";
    }
    if (this.status === 429) {
      return "Rate limit hit. Request was retried; reduce page size or wait before retrying.";
    }
    if (this.status >= 500) {
      return "Azure DevOps service error. Retry later or reduce request size.";
    }
    return "Request failed. Check input values and PAT scopes.";
  }
}

export class AdoClient {
  private static instance?: AdoClient;
  public readonly connection: azdev.WebApi;
  private readonly authHeader: string;
  private readonly cache: ResponseCache;

  private constructor(public readonly config: AdoConfig) {
    const authHandler = azdev.getPersonalAccessTokenHandler(config.pat);
    this.connection = new azdev.WebApi(config.organizationUrl, authHandler);
    this.authHeader = `Basic ${Buffer.from(`:${config.pat}`).toString("base64")}`;
    this.cache = new ResponseCache(config.cacheTtlSeconds, config.cacheMaxSize);
  }

  static getInstance(): AdoClient {
    if (!AdoClient.instance) {
      AdoClient.instance = new AdoClient(loadConfigFromEnv());
    }
    return AdoClient.instance;
  }

  /** Exposed for testing. */
  static _reset(): void {
    AdoClient.instance = undefined;
  }

  resolveProject(project?: string): string {
    const resolved = project ?? this.config.defaultProject;
    if (!resolved) {
      throw new Error("Project is required. Pass `project` or set AZURE_DEVOPS_PROJECT.");
    }
    return resolved;
  }

  route(project?: string, team?: string): string {
    const segments = [this.resolveProject(project), team].filter(Boolean) as string[];
    return segments.map(encodeRouteSegment).join("/");
  }

  resourceUrl(
    host: "almsearch" | "auditservice" | "feeds" | "vsrm" | "vssps" | "vsaex",
    path: string,
    project?: string
  ): string {
    const cleanPath = path.replace(/^\/+/, "");
    const projectPart = project ? `/${encodeRouteSegment(project)}` : "";
    return `https://${host}.dev.azure.com/${encodeRouteSegment(this.config.organization)}${projectPart}/_apis/${cleanPath}`;
  }

  analyticsUrl(entity: string, project?: string, apiVersion = "v4.0-preview"): string {
    const projectPart = project ? `/${encodeRouteSegment(project)}` : "";
    return `https://analytics.dev.azure.com/${encodeRouteSegment(this.config.organization)}${projectPart}/_odata/${apiVersion}/${entity}`;
  }

  async request<T = unknown>(
    method: HttpMethod,
    path: string,
    options: AdoRequestOptions = {}
  ): Promise<T> {
    return (await this.requestWithMeta<T>(method, path, options)).data;
  }

  async requestWithMeta<T = unknown>(
    method: HttpMethod,
    path: string,
    options: AdoRequestOptions = {}
  ): Promise<AdoResponse<T>> {
    return this.send<T>(method, path, options, "json");
  }

  async requestText(
    method: HttpMethod,
    path: string,
    options: AdoRequestOptions = {}
  ): Promise<string> {
    return (await this.send<string>(method, path, options, "text")).data;
  }

  async requestPaged<TItem = unknown>(
    method: HttpMethod,
    path: string,
    collectionKey: string,
    options: AdoRequestOptions = {},
    maxPages = 100
  ): Promise<{ items: TItem[]; continuationToken?: string }> {
    const items: TItem[] = [];
    let continuationToken = options.query?.continuationToken?.toString();

    for (let page = 0; page < maxPages; page += 1) {
      const response = await this.requestWithMeta<Record<string, unknown>>(method, path, {
        ...options,
        query: {
          ...options.query,
          continuationToken
        }
      });
      const data = response.data;
      const pageItems = extractItems<TItem>(data, collectionKey);
      items.push(...pageItems);
      continuationToken = response.continuationToken;
      if (!continuationToken) {
        return { items };
      }
    }

    return { items, continuationToken };
  }

  /**
   * Fetches all pages of a list endpoint automatically, following continuation tokens.
   * Use for large-org scenarios where result sets exceed a single page.
   */
  async fetchAllPages<TItem = unknown>(
    method: HttpMethod,
    path: string,
    collectionKey: string,
    options: AdoRequestOptions = {},
    maxItems = 50_000
  ): Promise<TItem[]> {
    const items: TItem[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.requestWithMeta<Record<string, unknown>>(method, path, {
        ...options,
        noCache: true,
        query: {
          ...options.query,
          continuationToken
        }
      });
      const pageItems = extractItems<TItem>(response.data, collectionKey);
      items.push(...pageItems);
      continuationToken = response.continuationToken;

      if (items.length >= maxItems) {
        break;
      }
    } while (continuationToken);

    return items;
  }

  /** Invalidate all cached responses that contain the given path substring. */
  invalidateCache(pattern: string): void {
    this.cache.invalidate(pattern);
  }

  clearCache(): void {
    this.cache.clear();
  }

  private async send<T>(
    method: HttpMethod,
    path: string,
    options: AdoRequestOptions,
    parseAs: "json" | "text"
  ): Promise<AdoResponse<T>> {
    const url = this.buildUrl(path, options);
    const retries = options.retries ?? 3;
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      Accept: parseAs === "json" ? "application/json" : "text/plain",
      ...options.headers
    };

    const hasBody = options.body !== undefined;
    const isPatchDocument = Array.isArray(options.body);
    if (hasBody && !headers["Content-Type"]) {
      headers["Content-Type"] = isPatchDocument ? "application/json-patch+json" : "application/json";
    }

    const isGet = method === "GET";
    const useCache = isGet && !options.noCache && parseAs === "json";
    if (useCache) {
      const cached = this.cache.get<AdoResponse<T>>(url);
      if (cached) return cached;
    }

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers,
        body: hasBody ? JSON.stringify(options.body) : undefined
      });

      if (isRetryable(response.status) && attempt < retries) {
        await sleep(retryDelayMs(response, attempt));
        continue;
      }

      const rawText = await response.text();
      if (!response.ok) {
        throw new AdoApiError(response.status, response.statusText, rawText, url);
      }

      const headersObject = Object.fromEntries(response.headers.entries());
      const continuationToken =
        response.headers.get("x-ms-continuationtoken") ??
        response.headers.get("x-ms-continuation-token") ??
        undefined;
      const data =
        parseAs === "text"
          ? rawText
          : rawText
            ? safeJsonParse(rawText)
            : undefined;

      const result: AdoResponse<T> = {
        data: data as T,
        continuationToken,
        headers: headersObject
      };

      if (useCache && !continuationToken) {
        this.cache.set(url, result);
      }

      return result;
    }

    throw new Error("Unreachable retry state.");
  }

  private buildUrl(path: string, options: AdoRequestOptions): string {
    const baseUrl = path.startsWith("http://") || path.startsWith("https://")
      ? new URL(path)
      : new URL(this.buildCollectionPath(path, options));

    const apiVersion = options.apiVersion === undefined ? this.config.apiVersion : options.apiVersion;
    if (apiVersion && !baseUrl.searchParams.has("api-version")) {
      baseUrl.searchParams.set("api-version", apiVersion);
    }

    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null) {
        baseUrl.searchParams.set(key, String(value));
      }
    }

    return baseUrl.toString();
  }

  private buildCollectionPath(path: string, options: AdoRequestOptions): string {
    const cleanPath = path.replace(/^\/+/, "");
    const apiPath = cleanPath.startsWith("_apis/") ? cleanPath : `_apis/${cleanPath}`;
    const routePrefix = options.routePrefix === undefined
      ? defaultRoutePrefix(options.project, this.config.defaultProject)
      : options.routePrefix;
    const route = routePrefix ? `/${routePrefix.replace(/^\/+|\/+$/g, "")}` : "";
    return `${this.config.organizationUrl}${route}/${apiPath}`;
  }
}

export function encodeRouteSegment(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "%20");
}

function loadConfigFromEnv(): AdoConfig {
  const pat = process.env.AZURE_DEVOPS_PAT ?? process.env.AZDO_PAT;
  if (!pat) {
    throw new Error("Missing AZURE_DEVOPS_PAT.");
  }

  const organization = process.env.AZURE_DEVOPS_ORG ?? inferOrganization(process.env.AZURE_DEVOPS_ORG_URL);
  if (!organization) {
    throw new Error("Missing AZURE_DEVOPS_ORG or AZURE_DEVOPS_ORG_URL.");
  }

  const organizationUrl = (process.env.AZURE_DEVOPS_ORG_URL ?? `https://dev.azure.com/${organization}`)
    .replace(/\/+$/, "");

  return {
    organization,
    organizationUrl,
    defaultProject: process.env.AZURE_DEVOPS_PROJECT,
    pat,
    apiVersion: process.env.AZURE_DEVOPS_API_VERSION ?? "7.1",
    cacheTtlSeconds: Number.parseInt(process.env.CACHE_TTL_SECONDS ?? "60", 10),
    cacheMaxSize: Number.parseInt(process.env.CACHE_MAX_SIZE ?? "500", 10)
  };
}

function defaultRoutePrefix(project: string | null | undefined, defaultProject?: string): string | null {
  if (project === null) {
    return null;
  }
  const resolved = project ?? defaultProject;
  return resolved ? encodeRouteSegment(resolved) : null;
}

function inferOrganization(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }
  const parsed = new URL(url);
  const segments = parsed.pathname.split("/").filter(Boolean);
  return segments[0];
}

function extractItems<TItem>(data: Record<string, unknown>, collectionKey: string): TItem[] {
  const direct = data[collectionKey];
  if (Array.isArray(direct)) {
    return direct as TItem[];
  }
  if (Array.isArray(data.value)) {
    return data.value as TItem[];
  }
  if (Array.isArray(data.items)) {
    return data.items as TItem[];
  }
  return [];
}

function isRetryable(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter && /^\d+$/.test(retryAfter)) {
    return Number(retryAfter) * 1000;
  }
  return Math.min(1000 * 2 ** attempt, 8000);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimForDisplay(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
