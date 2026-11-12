# Manager Web como app (PWA)

El juego se instala en el celular desde el navegador, sin tiendas y gratis. Después de la primera
visita funciona sin conexión: el código y los datos quedan guardados, y los escudos, logos, trofeos
y fotos se guardan a medida que aparecen en pantalla. La partida vive en IndexedDB del navegador y
el juego pide almacenamiento persistente para que el sistema no la borre.

## Instalar

**Android (Chrome, Edge, Samsung Internet)**
1. Abrí la dirección del juego.
2. En la pantalla principal tocá **Instalar app** (o menú ⋮ → *Instalar app* / *Agregar a pantalla principal*).

**iPhone / iPad (Safari)**
1. Abrí la dirección del juego en **Safari** (en iOS sólo Safari instala web apps).
2. Tocá **Compartir** (□↑) → **Agregar a inicio** → *Agregar*.
   El botón **Instalar app** de la pantalla principal muestra este mismo aviso.

**Computadora (Chrome / Edge)**: ícono de instalar en la barra de direcciones o el botón **Instalar app**.

Una vez instalada, el botón desaparece. Cuando hay una versión nueva aparece el aviso
*Hay una versión nueva — Actualizar*; la actualización espera a que la aceptes, así que nunca
corta un partido.

## Probar en local

```sh
cd manager-web
npm run build && npm run preview
```

El service worker sólo existe en el build (no en `npm run dev`). Abrí la URL que muestra
`vite preview` (por defecto http://localhost:4173). En Chrome: DevTools → *Application* →
*Manifest* / *Service workers*; con *Network → Offline* se comprueba que anda sin conexión.

Instalar y usar el service worker requiere **HTTPS**, salvo en `localhost`. Para probar en el
celular por la red local (`npm run preview -- --host`) la IP de la PC no es HTTPS, así que no se
instala: conviene probar sobre el hosting.

Los íconos salen de `manager-web/scripts/icons.mjs` (emblema propio en SVG rasterizado con sharp):
`node scripts/icons.mjs` regenera `public/icons/*` y `public/favicon.svg`.

## Publicar

El camino es un hosting estático gratuito con HTTPS, por ejemplo **Cloudflare Pages**:
proyecto conectado al repositorio (o `npx wrangler pages deploy dist`), comando de build
`npm run build`, carpeta de salida `dist`, directorio raíz `manager-web`. La URL `*.pages.dev`
ya trae HTTPS, y con eso se puede instalar en Android y iPhone.
