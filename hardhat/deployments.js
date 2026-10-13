const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "deployments.json");

function getDeployments() {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function saveDeployments(d) {
  const cur = getDeployments();
  const next = { ...cur, ...d, deployedAt: new Date().toISOString() };
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
  return next;
}

function requireDeployments() {
  const d = getDeployments();
  if (!d.deployerProxy) {
    throw new Error("No deployments found. Run deploy first: npm run deploy");
  }
  return d;
}

module.exports = { getDeployments, saveDeployments, requireDeployments };
