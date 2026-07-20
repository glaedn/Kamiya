import snapshot from "./generated/cerbanimo-contract.json";

export const CERBANIMO_CONTRACT_VERSION = snapshot.contractVersion;
export const CERBANIMO_CONTRACT_DIGEST = snapshot.digest;
export const CERBANIMO_CONTRACT_SCHEMAS = Object.freeze([...snapshot.schemas]);

export interface CerbanimoContractCompatibility {
  compatible: boolean;
  reason?: string;
}

export function checkCerbanimoContractIdentity(
  version: string | null | undefined,
  digest: string | null | undefined
): CerbanimoContractCompatibility {
  if (!version || !digest) {
    return {
      compatible: false,
      reason: "Cerbanimo did not provide its contract version and digest."
    };
  }
  if (version !== CERBANIMO_CONTRACT_VERSION) {
    return {
      compatible: false,
      reason: `Unsupported Cerbanimo contract version ${version}; expected ${CERBANIMO_CONTRACT_VERSION}.`
    };
  }
  if (digest !== CERBANIMO_CONTRACT_DIGEST) {
    return {
      compatible: false,
      reason: `Cerbanimo contract digest ${digest} does not match ${CERBANIMO_CONTRACT_DIGEST}.`
    };
  }
  return { compatible: true };
}
