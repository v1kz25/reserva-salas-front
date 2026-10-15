# reserva-salas-front

Aplicación web de reserva de salas. Consume la API de [`reserva-salas-back`](https://github.com/v1kz25/reserva-salas-back) según el [contrato](https://github.com/v1kz25/reserva-salas/blob/develop/contrato/openapi.yaml).

## Stack

- Angular 21 (componentes standalone, signals)
- SCSS
- ESLint (angular-eslint)
- Karma + Jasmine con Chrome Headless

## Requisitos

- Node 22 (ver `.nvmrc`; con nvm: `nvm use`). Angular 21 es compatible con Node 20.19+, 22.12+ y 24.
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

## Seguridad en despliegue

`npm run build` genera una aplicación estática en `dist/reserva-salas-front/browser`. En producción se sirve detrás de un proxy inverso (Nginx, Apache, Caddy...) que añade las cabeceras de seguridad y la caché, y que reenvía `/api` al backend.

### Mismo origen para `/api`

La aplicación llama a la API con rutas relativas (`/api/...`), así que el frontend y `/api` tienen que servirse **en el mismo origen** (mismo esquema, dominio y puerto), con el proxy inverso reenviando `/api/` al backend. El backend solo habilita CORS en su perfil `dev`; en producción no hay CORS.

El mismo origen también es necesario para la sesión y la protección CSRF:

- La sesión va en la cookie `JSESSIONID` (`HttpOnly`, `SameSite=Strict`).
- El backend envía el token CSRF en la cookie `XSRF-TOKEN`, que **no** es `HttpOnly` porque Angular la lee y la repite en la cabecera `X-XSRF-TOKEN` en cada `POST`, `PUT` y `DELETE`. Angular solo añade esa cabecera en peticiones a URLs relativas (mismo origen).
- Con HTTPS, ambas cookies deberían llevar también el atributo `Secure`.

### Cabeceras HTTP

| Cabecera | Valor recomendado |
|---|---|
| `Content-Security-Policy` | Ver el apartado siguiente |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` (o `no-referrer`) |
| `Permissions-Policy` | `geolocation=(), microphone=(), camera=()` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (solo en respuestas HTTPS) |

HSTS solo tiene sentido con HTTPS: el servidor HTTP del puerto 80 debe limitarse a redirigir a HTTPS.

### Content Security Policy

```text
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
```

- `script-src 'self'`: la build no genera scripts inline ni manejadores de eventos en línea; todos los scripts son ficheros `.js` servidos desde el mismo origen.
- `connect-src 'self'`: la app solo hace peticiones a `/api` en el mismo origen.
- `frame-ancestors 'none'`: impide incrustar la app en un `<iframe>` (sustituye a `X-Frame-Options: DENY`).
- `style-src 'self' 'unsafe-inline'`: `'unsafe-inline'` hace falta **solo para estilos**. Angular inserta en tiempo de ejecución elementos `<style>` con los estilos de los componentes (encapsulación emulada) y la CSP los bloquearía sin esa fuente. El riesgo es bajo porque los scripts siguen limitados a `'self'`. Para quitarlo habría que usar un nonce por petición (atributo `ngCspNonce` en `<app-root>` y `'nonce-...'` en la cabecera), lo que obliga al servidor a reescribir `index.html` en cada respuesta.

**Critical CSS desactivado.** Por defecto, la build de producción de Angular incrusta en `index.html` el CSS crítico en un `<style>` y carga la hoja de estilos con `<link media="print" onload="this.media='all'">`. Ese `onload` es un manejador de eventos inline: con `script-src 'self'` el navegador lo bloquea y la hoja de estilos global no se llegaría a aplicar. Por eso `angular.json` desactiva `optimization.styles.inlineCritical` en la configuración `production`: `index.html` solo lleva un `<link rel="stylesheet">` normal, sin `<style>` ni `onload`. A cambio se pierde una pequeña mejora del primer pintado, irrelevante con una hoja de estilos de este tamaño.

### Caché

| Recurso | `Cache-Control` | Motivo |
|---|---|---|
| `index.html` (y las rutas de la SPA que lo sirven) | `no-cache` | El navegador lo revalida en cada carga y así siempre apunta a los ficheros de la última versión. |
| Ficheros con hash en el nombre (`main-XXXXXXXX.js`, `chunk-XXXXXXXX.js`, `styles-XXXXXXXX.css`...) | `public, max-age=31536000, immutable` | Cada versión cambia el hash y, con él, el nombre: se pueden cachear sin límite. |
| Resto (`favicon.ico`, `favicon.svg`) | Caché corta, por ejemplo `public, max-age=86400` | No llevan hash. |
| `/api/` | La que envíe el backend | El proxy no debe cachear respuestas de la API. |

### Ejemplo con Nginx

Ejemplo orientativo: `example.com`, las rutas de los certificados y la dirección del backend son marcadores que hay que sustituir.

```nginx
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name example.com;

    ssl_certificate     /etc/ssl/example.com/fullchain.pem;
    ssl_certificate_key /etc/ssl/example.com/privkey.pem;

    root /var/www/reserva-salas-front/browser;
    index index.html;

    # Nginx no hereda los add_header del server en un location que defina los suyos,
    # así que las cabeceras de seguridad se incluyen también en cada location.
    include /etc/nginx/snippets/reserva-salas-seguridad.conf;

    # API en el mismo origen, reenviada al backend.
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Ficheros con hash: caché de un año.
    location ~* "-[A-Z0-9]{8}\.(js|css)$" {
        include /etc/nginx/snippets/reserva-salas-seguridad.conf;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        try_files $uri =404;
    }

    # Favicons: caché corta.
    location ~* "^/favicon\.(ico|svg)$" {
        include /etc/nginx/snippets/reserva-salas-seguridad.conf;
        add_header Cache-Control "public, max-age=86400" always;
    }

    # index.html y rutas de la SPA: revalidar siempre.
    location / {
        include /etc/nginx/snippets/reserva-salas-seguridad.conf;
        add_header Cache-Control "no-cache" always;
        try_files $uri $uri/ /index.html;
    }
}
```

`/etc/nginx/snippets/reserva-salas-seguridad.conf`:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

Para comprobarlo tras desplegar: abrir la app con las herramientas de desarrollo del navegador y verificar que la consola no muestra violaciones de CSP, y revisar las cabeceras con `curl -I https://example.com/`.

## Flujo de trabajo

Git Flow: se trabaja en ramas `feature/<n>-<slug>` desde `develop` y se integran por PR. El CI (lint, build y tests) tiene que pasar para poder fusionar. Consulta el [README del proyecto](https://github.com/v1kz25/reserva-salas) para más detalles.

## Licencia

[MIT](LICENSE)
