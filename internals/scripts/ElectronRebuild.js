const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');
const { dependencies } = require('../../app/package.json');

const appDir = path.join(__dirname, '..', '..', 'app');
const nodeModulesPath = path.join(appDir, 'node_modules');

if (Object.keys(dependencies || {}).length > 0 && fs.existsSync(nodeModulesPath)) {
  // @grpc/grpc-js is pure JS — no native build required. Other native deps in
  // app/ (if any) will be rebuilt by @electron/rebuild.
  const cmd = 'npx --no-install electron-rebuild --module-dir .';
  execSync(cmd, { cwd: appDir, stdio: 'inherit' });
}
