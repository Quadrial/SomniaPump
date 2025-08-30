import { createThirdwebClient } from "thirdweb";


// Load environment variable for CLIENT_ID
const clientId = import.meta.env.VITE_CLIENT_ID || '';

if (!clientId) {
  throw new Error('VITE_CLIENT_ID is not set. Add VITE_CLIENT_ID in your .env file at the root of the project.');
}

// Initialize the Thirdweb client
export const client = createThirdwebClient({
  clientId, // Ensure CLIENT_ID is passed
});