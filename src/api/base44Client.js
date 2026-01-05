import { createClient } from '@base44/sdk';
import { mockBase44 } from './mockBase44Client';

// Check if we're in development mode on localhost
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Check for mock mode flag in URL or localStorage
const useMockMode = isLocalhost && (
  new URLSearchParams(window.location.search).get('mock') === 'true' ||
  localStorage.getItem('base44_mock_mode') === 'true'
);

let base44;

if (useMockMode) {
  console.log('%c⚠️ Mock Mode Active', 'color: orange; font-weight: bold; font-size: 14px;');
  console.log('%cUsing Mock Base44 Client for local development', 'color: #888;');
  console.log('%cTo use real Base44, remove ?mock=true from URL or set localStorage.base44_mock_mode = false', 'color: #888;');
  base44 = mockBase44;
} else {
  // Create a real Base44 client
  base44 = createClient({
    serverUrl: 'https://base44.app',
    appId: "68682c1685e4902d2e91e89a", 
    requiresAuth: true,
    autoInitAuth: true,
  });
}

export { base44 };
