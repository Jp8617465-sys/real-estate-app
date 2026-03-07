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

/**
 * Error thrown by LinkedIn API client.
 */
export class LinkedInAPIError extends IntegrationAPIError {
  constructor(message: string, statusCode: number, statusText: string) {
    super(message, statusCode, statusText);
    this.name = 'LinkedInAPIError';
  }
}

/**
 * Error thrown by Anthropic (Claude) API client.
 */
export class AnthropicAPIError extends IntegrationAPIError {
  public readonly errorType: string;

  constructor(message: string, statusCode: number, statusText: string, errorType = 'api_error') {
    super(message, statusCode, statusText);
    this.name = 'AnthropicAPIError';
    this.errorType = errorType;
  }
}
