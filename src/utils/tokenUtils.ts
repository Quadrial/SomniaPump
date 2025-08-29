// src/utils/tokenUtils.ts
import { readContract } from "thirdweb";

/**
 * Reads all metadata stored on-chain for a token from the factory contract.
 * Prioritizes `getTokenInfo` (full struct), falls back to `getTokenMetadata` (shorthand).
 *
 * @param factoryContract  The TokenFactory contract instance.
 * @param tokenAddress     The address of the token to query.
 * @returns                An object with all metadata (name, symbol, description, imageURI, socials).
 */
export async function fetchTokenInfoOnChain(
  factoryContract: any,
  tokenAddress: string
): Promise<{
  name: string;
  symbol: string;
  description: string;
  imageURI: string;
  twitter: string;
  telegram: string;
  website: string;
  createdAt?: bigint; // Only available if getTokenInfo is used
  lpLocked?: boolean;
  lockId?: bigint;
}> {
  try {
    // Try to call the full `getTokenInfo` function first
    const data = await readContract({
      contract: factoryContract,
      method:
        "function getTokenInfo(address) view returns (address token, address creator, string name, string symbol, string description, string imageURI, string twitter, string telegram, string website, uint256 createdAt, bool lpLocked, uint256 lockId)",
      params: [tokenAddress],
    });

    // Thirdweb returns named properties for structs, which is convenient
    return {
      name: data.name,
      symbol: data.symbol,
      description: data.description,
      imageURI: data.imageURI,
      twitter: data.twitter,
      telegram: data.telegram,
      website: data.website,
      createdAt: data.createdAt,
      lpLocked: data.lpLocked,
      lockId: data.lockId,
    };
  } catch (e) {
    // If getTokenInfo fails, try the shorthand getTokenMetadata
    // (This would happen if the contract only has getTokenMetadata, or an older version)
    console.warn(
      `getTokenInfo failed for ${tokenAddress}, trying getTokenMetadata.`,
      e
    );
    const meta = await readContract({
      contract: factoryContract,
      method:
        "function getTokenMetadata(address) view returns (string name, string symbol, string description, string imageURI, string twitter, string telegram, string website)",
      params: [tokenAddress],
    });

    // `getTokenMetadata` returns an array if accessed directly from the contract,
    // so we access by index or ensure the method returns named properties.
    // Assuming it returns named properties for simplicity here, or you'd destructure:
    // const [name, symbol, description, imageURI, twitter, telegram, website] = meta as [string, string, string, string, string, string, string];
    // Then return an object. For clarity, I'm assuming thirdweb gives named properties if defined.

    // If the contract method is defined to return named properties and thirdweb handles it:
    return {
      name: meta.name,
      symbol: meta.symbol,
      description: meta.description,
      imageURI: meta.imageURI,
      twitter: meta.twitter,
      telegram: meta.telegram,
      website: meta.website,
      // createdAt, lpLocked, lockId are not available via this getter
    };
  }
}
