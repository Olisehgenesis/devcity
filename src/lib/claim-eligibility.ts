import { CLAIM_RADIUS_M, distanceMeters, formatDistance } from "./geo";

export type ClaimLocationStatus = "checking" | "ready" | "denied" | "unavailable";

export type ClaimFlowState =
  | "checking-location"
  | "permission-required"
  | "location-unavailable"
  | "too-far"
  | "ready"
  | "awaiting-signature"
  | "success"
  | "failed";

export type ClaimView = {
  state: ClaimFlowState;
  distanceM: number | null;
  canPressClaim: boolean;
  title: string;
  detail: string;
};

export function claimDistanceSentence(meters: number): string {
  return `You're ${formatDistance(meters)} away from this drop.`;
}

export function claimOutOfRangeMessage(meters: number): string {
  return `${claimDistanceSentence(meters)} You must be within 100 m to claim.`;
}

export function parseClaimCoordinate(value: unknown, min: number, max: number): number | null {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number.NaN;
  if (!Number.isFinite(numeric) || numeric < min || numeric > max) return null;
  return numeric;
}

export function resolveClaimView(input: {
  claimed: boolean;
  locating: boolean;
  signing: boolean;
  locationStatus: ClaimLocationStatus;
  userLat: number | null;
  userLng: number | null;
  dropLat: number;
  dropLng: number;
  failedMessage: string | null;
}): ClaimView {
  if (input.claimed) {
    return {
      state: "success",
      distanceM: null,
      canPressClaim: false,
      title: "Claim successful",
      detail: "Your wallet signed this claim. The tokens are in that wallet.",
    };
  }
  if (input.signing) {
    return {
      state: "awaiting-signature",
      distanceM: null,
      canPressClaim: false,
      title: "Waiting for wallet signature",
      detail: "Waiting for wallet signature. Nothing is claimed until the transaction is confirmed.",
    };
  }
  if (input.locating || input.locationStatus === "checking") {
    return {
      state: "checking-location",
      distanceM: null,
      canPressClaim: false,
      title: "Checking location",
      detail: "Checking location. Claim stays off until this device shares your coordinates.",
    };
  }
  if (input.locationStatus === "denied") {
    return {
      state: "permission-required",
      distanceM: null,
      canPressClaim: false,
      title: "Location permission required",
      detail: "Location permission is required. Allow location for this site in your browser settings, then try again. Claims stay off until location is on.",
    };
  }
  if (input.locationStatus === "unavailable") {
    return {
      state: "location-unavailable",
      distanceM: null,
      canPressClaim: false,
      title: "Location unavailable",
      detail: "Location is unavailable. Turn on location services for this browser and try again. Claims stay off until a position is found.",
    };
  }

  const hasFix = Number.isFinite(input.userLat) && Number.isFinite(input.userLng)
    && Number.isFinite(input.dropLat) && Number.isFinite(input.dropLng);
  if (!hasFix || input.userLat == null || input.userLng == null) {
    return {
      state: "checking-location",
      distanceM: null,
      canPressClaim: false,
      title: "Checking location",
      detail: "Checking location. Claim stays off until this device shares your coordinates.",
    };
  }

  const distanceM = distanceMeters(input.userLat, input.userLng, input.dropLat, input.dropLng);
  if (distanceM > CLAIM_RADIUS_M) {
    return {
      state: "too-far",
      distanceM,
      canPressClaim: false,
      title: "You're too far away",
      detail: claimOutOfRangeMessage(distanceM),
    };
  }
  if (input.failedMessage) {
    return {
      state: "failed",
      distanceM,
      canPressClaim: true,
      title: "Claim failed",
      detail: input.failedMessage,
    };
  }
  return {
    state: "ready",
    distanceM,
    canPressClaim: true,
    title: "Ready to claim",
    detail: claimDistanceSentence(distanceM),
  };
}

/** Reuse an unlocked session. Ask for the PIN only when the key is still locked. */
export function claimNeedsPin(unlocked: boolean, pin: string): "reuse" | "ask" | "unlock" {
  if (unlocked) return "reuse";
  return /^\d{6}$/.test(pin) ? "unlock" : "ask";
}

export function claimFailureMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message.trim() : "";
  if (/operationerror|unable to decrypt|decrypt/i.test(raw)) {
    return "That PIN didn't unlock this wallet. Nothing was claimed.";
  }
  if (/user rejected|user denied|rejected the request|denied transaction signature/i.test(raw)) {
    return "The wallet signature was rejected. Nothing was claimed.";
  }
  if (/insufficient funds|gas required exceeds/i.test(raw)) {
    return "The wallet couldn't pay the network fee. Nothing was claimed.";
  }
  if (raw && raw.length <= 220) return raw;
  return "Claim failed. The transaction was not confirmed.";
}
