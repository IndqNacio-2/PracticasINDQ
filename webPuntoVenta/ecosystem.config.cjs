// Configuración de pm2 para el servidor.
//
//   pm2 start ecosystem.config.cjs                 -> API + frontend
//   pm2 start ecosystem.config.cjs --only nuucleo-api   -> solo la API (si Nginx sirve el frontend)
//
// Antes de arrancar:
//   - Crear los .env de backend/, backend-administrativa/ y backend-cobro/
//     (GATEWAY_PORT define el puerto de la API; por defecto 3000).
//   - Compilar el frontend: cd frontend && npm run build
const path = require('node:path');

module.exports = {
  apps: [
    {
      // API unificada: /pos/api, /admin/api y /cobro/api en un solo puerto.
      // Equivale a `npm run dev:unified`, pero sin modo watch.
      name: 'nuucleo-api',
      cwd: path.join(__dirname, 'backend'),
      script: './node_modules/tsx/dist/cli.mjs',
      args: 'src/gateway.ts',
      interpreter: 'node',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_memory_restart: '700M',
      time: true,
    },
    {
      // Frontend ya compilado (frontend/dist) servido por `vite preview`.
      // Reenvía /pos/api, /admin/api y /cobro/api a la API (GATEWAY_PORT de
      // frontend/.env). Si Nginx sirve el frontend, no arranques esta app.
      name: 'nuucleo-front',
      cwd: path.join(__dirname, 'frontend'),
      script: './node_modules/vite/bin/vite.js',
      args: 'preview',
      interpreter: 'node',
      env: { PORT: '8443' },
      autorestart: true,
      time: true,
    },
  ],
};
