// The app's training logic lives in core/ at the top of this repo, imported as
// '@increment/core' (see tsconfig.json "paths").
// Watching that folder means edits to the core reload the app right away.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, '../core')];

module.exports = config;
