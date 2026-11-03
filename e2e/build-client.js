// Builds the website exactly as production does (build, server build, prerender), but in a
// temporary copy so a local client/dist folder is never touched. Returns the dist folder.
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

module.exports = function buildClient() {
    const source = path.join(__dirname, '..', 'client');
    const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'boat-e2e-')), 'client');
    fs.cpSync(source, copy, {
        recursive: true,
        filter: (file) => !['node_modules', 'dist', 'dist-server'].includes(path.relative(source, file).split(path.sep)[0]),
    });
    fs.symlinkSync(path.join(source, 'node_modules'), path.join(copy, 'node_modules'), 'dir');
    execSync('npm run build', { cwd: copy, stdio: 'pipe' });
    return path.join(copy, 'dist');
};
