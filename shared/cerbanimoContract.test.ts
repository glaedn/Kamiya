import { describe, expect, it } from "vitest";
import {
  CERBANIMO_CONTRACT_DIGEST,
  CERBANIMO_CONTRACT_VERSION,
  checkCerbanimoContractIdentity
} from "./cerbanimoContract";

describe("Cerbanimo contract identity", () => {
  it("accepts the exact supported version and digest", () => {
    expect(checkCerbanimoContractIdentity(CERBANIMO_CONTRACT_VERSION, CERBANIMO_CONTRACT_DIGEST)).toEqual({ compatible: true });
  });

  it.each([
    [null, CERBANIMO_CONTRACT_DIGEST],
    [CERBANIMO_CONTRACT_VERSION, null],
    ["0.9.0", CERBANIMO_CONTRACT_DIGEST],
    [CERBANIMO_CONTRACT_VERSION, "sha256:stale"]
  ])("rejects missing or stale identity (%s, %s)", (version, digest) => {
    expect(checkCerbanimoContractIdentity(version, digest).compatible).toBe(false);
  });
});
