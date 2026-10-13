// Verify all deployed implementations + proxies on Sourcify (v2 API).
// Uses the standard JSON input from hardhat's build-info.
// Run: npm run verify
const CHAIN = "11142220";
const API = "https://sourcify.dev/server/v2/verify";

const targets = [
  ["DEVCITY26Deployer", "0xf81508dEd268b941fa414255ffdfF310eAA61F01", "contracts/DEVCITY26Deployer.sol", "DEVCITY26Deployer"],
  ["DropClaim", "0xb572d7eb1b0b0eea52bca1e17f41bb2dfd919364", "contracts/DropClaim.sol", "DropClaim"],
  ["ProfileTokenFactory", "0x3dae34e1364eb1df53ba081f0bec7f1540feda82", "contracts/ProfileTokenFactory.sol", "ProfileTokenFactory"],
  ["DEVCITY26Token", "0x877952b7fc596d46dbcb880a8171808b214d4448", "contracts/DEVCITY26Token.sol", "DEVCITY26Token"],
  ["ERC1967Proxy (deployer)", "0x30490BD7d4fDD9F7Ca4CbAdA5770f48a32A9278b", "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol", "ERC1967Proxy"],
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const buildInfo = require("../artifacts/build-info/8f8b97db3a68ac1de6976c6490e1b4e0.json");
  const input = buildInfo.input;
  const compilerVersion = buildInfo.solcLongVersion;

  console.log(`Verifying on Sourcify (chain ${CHAIN})...\n`);
  for (const [name, address, src, contractName] of targets) {
    process.stdout.write(`${name}: `);
    const body = { stdJsonInput: input, compilerVersion, contractIdentifier: `${src}:${contractName}` };
    const resp = await fetch(`${API}/${CHAIN}/${address}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    if (json.error || json.errors || json.message) {
      console.log("ERROR", json.error || json.message || JSON.stringify(json.errors));
      continue;
    }
    const vid = json.verificationId;
    // poll until done
    let result = null;
    for (let i = 0; i < 15; i++) {
      await sleep(3000);
      const s = await (await fetch(`${API}/${vid}`)).json();
      if (s.isJobCompleted) { result = s; break; }
    }
    if (!result) { console.log("timeout polling"); continue; }
    const c = result.contract;
    console.log(`match=${c.match}  verifiedAt=${c.verifiedAt}`);
  }
  console.log("\nDone. Check https://repo.sourcify.dev on chain 11142220.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
