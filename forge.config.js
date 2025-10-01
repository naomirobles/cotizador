const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: false,
    icon: './assets/icon', // Si tienes icono
    extraResource: [
      './node_modules/puppeteer/.local-chromium'
    ],
    extraSource: [
      // Incluir archivos CSS explícitamente
      './src/output.css'
    ],
    ignore: [
      /^\/\.git/,
      /^\/\.gitignore$/,
      /^\/README\.md$/,
      /^\/\.env/,
      /^\/scripts/,
      // NO ignorar estos archivos CSS:
      // /^\/src\/.*\.css$/,
      /^\/postcss\.config\.js$/,
      /^\/tailwind\.config\.js$/
    ],
    // Configuración específica para Windows
    win32metadata: {
      CompanyName: "Tu Empresa",
      ProductName: "Cotizador"
    },
    // NUEVO: Configuraciones para evitar colgado
    protocols: [],
    prune: false, // No eliminar dependencias "no utilizadas"
    derefSymlinks: false
  },
  rebuildConfig: {
    // Configuración específica para rebuild
    force: true
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'cotizador'
      }
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['win32']
    }
  ],
  plugins: [
    // TEMPORAL: Remover todos los plugins que puedan causar problemas
    // Se pueden agregar de vuelta uno por uno después
  ]
};