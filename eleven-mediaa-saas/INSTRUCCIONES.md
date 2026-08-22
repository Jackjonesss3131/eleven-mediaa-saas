# LEE ESTO PRIMERO — 3 pasos

Este proyecto YA fue compilado y probado. El build pasa sin errores.

## Paso 1 — Sube el proyecto

Borra los archivos viejos de tu repo y pon estos en su lugar.
Sube todo a GitHub (commit + push).

IMPORTANTE: sube tambien el archivo `package-lock.json`. Sin el,
Vercel instala versiones distintas y el build puede fallar.

## Paso 2 — Apaga el Build Command manual en Vercel

Esto es lo unico que tienes que hacer a mano, y es la causa mas
probable de tu error actual:

  Vercel -> tu proyecto -> Settings -> Build and Deployment
  -> campo "Build Command"
  -> si el switch "Override" esta ENCENDIDO, APAGALO.

Si ese campo dice "vite build", va a seguir fallando aunque el
codigo este perfecto, porque el panel manda sobre el archivo.

Mientras estas ahi, en Settings -> Environment Variables:
si existe una variable llamada NODE_ENV, borrala.

## Paso 3 — Agrega tu API key

  Vercel -> Settings -> Environment Variables -> Add

  Name:  GEMINI_API_KEY
  Value: (tu key de https://aistudio.google.com/apikey)

Marca los 3 entornos (Production, Preview, Development). Guarda.

## Listo

Vercel redespliega solo tras el push. Si ya habias hecho push antes
de tocar el Build Command, entra a Deployments y dale "Redeploy".

---

## Que cambio respecto a la version anterior

1. package.json: el build ahora llama a vite por su ruta directa
   (node ./node_modules/vite/bin/vite.js) en vez de depender de que
   el comando "vite" este disponible en el PATH. Ese era el error 127.

2. package.json: vite y sus plugins pasaron a "dependencies", asi
   se instalan siempre, sin importar la configuracion del servidor.

3. package.json: se quito "tsc -b" del build. El chequeo de tipos
   no aporta nada en produccion y es otra fuente comun de fallos.

4. vercel.json: se simplifico. Se quitaron el bloque "functions" y
   "framework". Vercel detecta la carpeta api/ automaticamente.

## Desarrollo local

  npm install
  npx vercel dev     <- levanta frontend Y la funcion /api/analyze

Con "npm run dev" solo levanta el frontend; la ruta /api no responde.

## Conectar el lead magnet (cuando quieras)

En src/App.tsx, funcion handleUnlock: descomenta el bloque fetch y
pega tu webhook de Make.com. El payload ya lleva email, nombre del
SaaS, tipo de analisis y score.
