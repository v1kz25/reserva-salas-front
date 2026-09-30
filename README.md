# reserva-salas-front

Aplicación web de reserva de salas. Consume la API de [`reserva-salas-back`](https://github.com/v1kz25/reserva-salas-back) según el [contrato](https://github.com/v1kz25/reserva-salas/blob/develop/contrato/openapi.yaml).

## Stack

- Angular 19 (componentes standalone, signals)
- SCSS
- ESLint (angular-eslint)
- Karma + Jasmine con Chrome Headless

## Requisitos

- Node 22 (ver `.nvmrc`; con nvm: `nvm use`). Angular 19 no es compatible con Node 24.
- Chrome o Chromium para los tests. Si solo tienes Chromium, exporta `CHROME_BIN` con su ruta (por ejemplo, `export CHROME_BIN=/snap/bin/chromium`).

## Arranque

```bash
npm ci
npm start
```

La aplicación queda en `http://localhost:4200`. Las peticiones a `/api` se redirigen a `http://localhost:8080` (ver `proxy.conf.json`), así que conviene tener el backend arrancado.

## Comandos

```bash
npm run lint                                          # linter
npm run build                                         # compilación
npm test -- --watch=false --browsers=ChromeHeadless   # tests unitarios
```

## Flujo de trabajo

Git Flow: se trabaja en ramas `feature/<n>-<slug>` desde `develop` y se integran por PR. El CI (lint, build y tests) tiene que pasar para poder fusionar. Consulta el [README del proyecto](https://github.com/v1kz25/reserva-salas) para más detalles.

## Licencia

[MIT](LICENSE)
