const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');
const fs = require('fs');

// Función para encontrar recursos de Puppeteer
function findPuppeteerResources() {
  const possiblePaths = [
    './node_modules/puppeteer/.local-chromium/',
    './node_modules/@puppeteer/browsers/',
    './node_modules/puppeteer-core/.local-chromium/'
  ];
  
  const existingPaths = possiblePaths.filter(p => fs.existsSync(p));
  return existingPaths;
}

module.exports = {
  packagerConfig: {
    asar: {
      unpack: '**/node_modules/{sqlite3,puppeteer,@puppeteer,puppeteer-core}/**/*'
    },
    extraResource: [
      ...findPuppeteerResources(),
      './node_modules/sqlite3/lib/binding/'
    ].filter(path => fs.existsSync(path)), // Solo incluir rutas que existan
    // Cambiar directorio de salida
    out: './build-temp',
    // Ignorar archivos problemáticos
    ignore: [
      /^\/\.vscode/,
      /^\/node_modules\/\.cache/,
      /^\/out/,
      /^\/dist/,
      /\.log$/,
      /\.tmp$/
    ],
    // Configuración para Windows
    platform: 'win32',
    arch: 'x64',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: false, // ⚠️ IMPORTANTE: Cambiar a false
    }),
  ],
};