import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mock handlers for API requests
const handlers = [
  // Mock content endpoints
  http.get('/api/content', () => {
    return HttpResponse.json([]);
  }),
  
  // Add more mock handlers as needed
];

// Setup MSW server
const server = setupServer(...handlers);

// Start the server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Close server after all tests
afterAll(() => server.close());