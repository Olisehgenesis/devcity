import { ethers } from 'ethers';

const DOMAIN = {
  name: 'DEVCITY26',
  version: '1',
  chainId: 84532,
};

const CLAIM_AUTH_TYPE = {
  ClaimAuth: [
    { name: 'dropId', type: 'bytes32' },
    { name: 'claimer', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiresAt', type: 'uint256' },
  ],
};

export async function signClaimAuthorization(
  dropId: string,
  claimer: string,
  nonce: number,
  expiresAt: number
): Promise<string> {
  const privateKey = process.env.BACKEND_SIGNER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('BACKEND_SIGNER_PRIVATE_KEY not set');
  }

  const signer = new ethers.Wallet(privateKey);

  const message = {
    dropId: ethers.id(dropId),
    claimer,
    nonce,
    expiresAt,
  };

  const signature = await signer.signTypedData(DOMAIN, CLAIM_AUTH_TYPE, message);
  return signature;
}

export async function verifyClaimAuthorization(
  dropId: string,
  claimer: string,
  nonce: number,
  expiresAt: number,
  signature: string
): Promise<boolean> {
  try {
    const message = {
      dropId: ethers.id(dropId),
      claimer,
      nonce,
      expiresAt,
    };

    const recoveredAddress = ethers.verifyTypedData(
      DOMAIN,
      CLAIM_AUTH_TYPE,
      message,
      signature
    );

    const expectedSigner = new ethers.Wallet(
      process.env.BACKEND_SIGNER_PRIVATE_KEY || ''
    ).address;

    return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}
