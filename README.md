# Mis documentos

App personal para guardar documentos (DUI, pasaporte, licencia, etc.) con fotos, fechas y avisos de vencimiento. Funciona en el navegador del celular y se puede agregar a la pantalla de inicio.

## Publicarla en GitHub Pages

1. Crea un repositorio nuevo en GitHub (por ejemplo `mis-documentos`).
2. Sube todos los archivos de esta carpeta a la raíz del repositorio.
3. En el repositorio ve a **Settings → Pages**, elige la rama `main` y la carpeta `/ (root)`, y guarda.
4. Abre en el celular la dirección que te da GitHub (`https://tu-usuario.github.io/mis-documentos/`).
5. En el menú del navegador elige **Agregar a pantalla de inicio** para usarla como app.

## Cómo protege tus datos

- **Los documentos nunca se suben a GitHub.** El repositorio solo contiene el código. Tus datos viven únicamente en el almacenamiento del navegador de tu celular.
- **Todo se guarda cifrado** con AES-256-GCM. La llave se deriva de tu PIN de 6 dígitos con PBKDF2-SHA256 (600 000 iteraciones). La app no guarda tu PIN ni ninguna versión de él.
- **La huella también cifra**: usa WebAuthn con la extensión PRF, así que la huella genera su propia llave para abrir los datos. Si tu celular no soporta PRF, la app solo permite el PIN.
- **Sin conexiones externas**: una política de seguridad de contenido (CSP) impide que la página cargue o envíe cualquier cosa fuera de sus propios archivos. No hay fuentes, analíticas ni librerías de terceros.
- **No se puede incrustar** en otra página (protección contra clickjacking).
- **Se bloquea sola** a los 30 segundos de salir de la app, a los 3 minutos sin uso, y borra los datos descifrados de la memoria al bloquearse.
- **Intentos fallidos**: a partir del tercer PIN incorrecto, la espera crece (5 s, 10 s, 20 s… hasta 5 minutos).
- **Copias de seguridad cifradas**: el archivo que descargas solo se abre con el PIN que tenías al crearlo.

## Recomendaciones

- Activa la verificación en dos pasos en tu cuenta de GitHub. Si alguien entrara a tu cuenta, podría cambiar el código de la app.
- Todas las páginas de `tu-usuario.github.io` comparten el mismo origen. No publiques en esa misma cuenta páginas de terceros que no conozcas. (Tus datos siguen cifrados, pero es una buena práctica.)
- Si olvidas tu PIN y no tienes la huella activa, los documentos no se pueden recuperar. Descarga una copia cifrada de vez en cuando.
- Mantén tu celular con bloqueo de pantalla.
