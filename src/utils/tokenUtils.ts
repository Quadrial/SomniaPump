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

        const [, , name, symbol, description, imageURI, twitter, telegram, website, createdAt, lpLocked, lockId] = data;

    // Thirdweb returns named properties for structs, which is convenient
    return {
      name,
      symbol,
      description,
      imageURI,
      twitter,
      telegram,
      website,
      createdAt,
      lpLocked,
      lockId,
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

    const [name, symbol, description, imageURI, twitter, telegram, website] = meta;

    // If the contract method is defined to return named properties and thirdweb handles it:
    return {
      name,
      symbol,
      description,
      imageURI,
      twitter,
      telegram,
      website,
      // createdAt, lpLocked, lockId are not available via this getter
    };
  }
}
