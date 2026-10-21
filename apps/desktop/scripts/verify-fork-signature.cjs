// A local macOS package must have a valid sealed signature before installation.
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

module.exports = async function verifyForkSignature(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appPath = join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  execFileSync(
    "/usr/bin/codesign",
    ["--verify", "--deep", "--strict", appPath],
    { stdio: "inherit" },
  );
};
