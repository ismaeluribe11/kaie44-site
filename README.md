# kaie44.org · Kingdom Alliance International

Sitio web estático (sin compilación) publicado en Netlify.

- `index.html` · todas las páginas (rutas con `#/`)
- `members.js` · Área de Miembros y credencial
- `apply*.js/css` · Aplicación de membresía
- `staff.js/css` · Panel del equipo
- `events*.js/css` · Eventos (página pública, registro, check-in, panel)
- `images/` · imágenes del sitio

La base de datos (Supabase), los correos (Resend) y los SQL **no** están aquí.
Nunca subir llaves, contraseñas ni secretos a este repositorio.

Flujo: los cambios van a la rama `cambios` (vista previa gratis en Netlify) y se pasan a `main` para publicar en kaie44.org.
