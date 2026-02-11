/**
 * Base error class for integration API errors.
 * Provides structured error information with HTTP status details.
 */
export class IntegrationAPIError extends Error {
  public readonly statusCode: number;
  public readonly statusText: string;

  constructor(message: string, statusCode: number, statusText: string) {
    super(`${message}: ${statusCode} ${statusText}`);
    this.name = 'IntegrationAPIError';
    this.statusCode = statusCode;
    this.statusText = statusText;
  }
}

/**
 * Error thrown by Domain.com.au API client.
 */
export class DomainAPIError extends IntegrationAPIError {
  constructor(message: string, statusCode: number, statusText: string) {
    super(message, statusCode, statusText);
    this.name = 'DomainAPIError';
  }
}

/**
 * Error thrown by Meta (Facebook/Instagram) Graph API client.
 */
export class MetaAPIError extends IntegrationAPIError {
  constructor(message: string, statusCode: number, statusText: string) {
    super(message, statusCode, statusText);
    this.name = 'MetaAPIError';
  }
}
