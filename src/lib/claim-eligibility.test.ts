import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDistance } from "./geo";
import {
  claimFailureMessage,
  claimNeedsPin,
  claimOutOfRangeMessage,
  parseClaimCoordinate,
  resolveClaimView,
} from "./claim-eligibility";

const drop = { dropLat: 19.063126, dropLng: 72.865624 };

function view(overrides: Partial<Parameters<typeof resolveClaimView>[0]> = {}) {
  return resolveClaimView({
    claimed: false,
    locating: false,
    signing: false,
    locationStatus: "ready",
    userLat: drop.dropLat,
    userLng: drop.dropLng,
    ...drop,
    failedMessage: null,
    ...overrides,
  });
}

describe("claim eligibility", () => {
  it("formats a 5,000 km distance", () => {
    assert.equal(formatDistance(5_000_000), "5,000 km");
    assert.match(claimOutOfRangeMessage(5_000_000), /You're 5,000 km away from this drop/);
  });

  it("stays on checking location before a fix, even if coordinates are already present", () => {
    const result = view({ locationStatus: "checking" });
    assert.equal(result.state, "checking-location");
    assert.equal(result.title, "Checking location");
    assert.equal(result.canPressClaim, false);
    assert.notEqual(result.title, "Ready to claim");
  });

  it("requires location permission and ignores a stale in-range fix", () => {
    const result = view({ locationStatus: "denied" });
    assert.equal(result.state, "permission-required");
    assert.equal(result.title, "Location permission required");
    assert.equal(result.distanceM, null);
    assert.equal(result.canPressClaim, false);
  });

  it("blocks claiming when location is unavailable", () => {
    const result = view({ locationStatus: "unavailable", userLat: null, userLng: null });
    assert.equal(result.state, "location-unavailable");
    assert.equal(result.title, "Location unavailable");
    assert.equal(result.canPressClaim, false);
  });

  it("shows the real distance and disables claim when the user is far away", () => {
    const result = view({ userLat: drop.dropLat + 45, userLng: drop.dropLng });
    assert.equal(result.state, "too-far");
    assert.equal(result.title, "You're too far away");
    assert.equal(result.canPressClaim, false);
    assert.ok(result.distanceM != null && result.distanceM > 100);
    assert.match(result.detail, /You're .+ away from this drop\. You must be within 100 m to claim\./);
  });

  it("is ready to claim only inside 100 metres after location is verified", () => {
    const result = view();
    assert.equal(result.state, "ready");
    assert.equal(result.title, "Ready to claim");
    assert.equal(result.canPressClaim, true);
    assert.ok(result.distanceM != null && result.distanceM <= 100);
    assert.match(result.detail, /You're .+ away from this drop\./);
  });

  it("re-checks location before showing ready again", () => {
    const result = view({ locating: true });
    assert.equal(result.state, "checking-location");
    assert.equal(result.canPressClaim, false);
  });

  it("waits for the wallet signature without marking the claim successful", () => {
    const result = view({ signing: true });
    assert.equal(result.state, "awaiting-signature");
    assert.equal(result.title, "Waiting for wallet signature");
    assert.equal(result.canPressClaim, false);
  });

  it("shows claim failed and keeps retry available when the signature is rejected", () => {
    const message = claimFailureMessage(new Error("User rejected the request."));
    const result = view({ failedMessage: message });
    assert.match(message, /signature was rejected/);
    assert.equal(result.state, "failed");
    assert.equal(result.title, "Claim failed");
    assert.equal(result.canPressClaim, true);
    assert.equal(result.detail, message);
  });

  it("shows claim successful only after the claim is confirmed", () => {
    const result = view({ claimed: true, failedMessage: "The wallet signature was rejected. Nothing was claimed." });
    assert.equal(result.state, "success");
    assert.equal(result.title, "Claim successful");
    assert.equal(result.canPressClaim, false);
  });

  it("reuses an unlocked wallet and asks for the PIN only when the key is locked", () => {
    assert.equal(claimNeedsPin(true, ""), "reuse");
    assert.equal(claimNeedsPin(true, "123456"), "reuse");
    assert.equal(claimNeedsPin(false, ""), "ask");
    assert.equal(claimNeedsPin(false, "12345"), "ask");
    assert.equal(claimNeedsPin(false, "123456"), "unlock");
  });

  it("rejects missing or impossible coordinates", () => {
    assert.equal(parseClaimCoordinate(undefined, -90, 90), null);
    assert.equal(parseClaimCoordinate("nope", -90, 90), null);
    assert.equal(parseClaimCoordinate(91, -90, 90), null);
    assert.equal(parseClaimCoordinate("19.063126", -90, 90), 19.063126);
  });
});
