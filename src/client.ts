import { createThirdwebClient } from "thirdweb";

const clientId = import.meta.env.VITE_CLIENT_ID || '';

if (!clientId) {
  console.warn('VITE_CLIENT_ID is not set. Add VITE_CLIENT_ID to your .env file in project root.');
}

export const client = createThirdwebClient({
  clientId,
});
