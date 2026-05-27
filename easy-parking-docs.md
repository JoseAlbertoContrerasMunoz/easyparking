# Easy Parking - Documentación del Proyecto

## Contexto
**Easy Parking** es una aplicación web responsiva enfocada en reportar y monitorear el estado de ocupación de estacionamientos en tiempo real. Utiliza geolocalización, mapas interactivos y una base de datos reactiva para mantener la información siempre sincronizada.

Esta aplicación fue creada como MVP y utiliza la pila moderna de Next.js (App Router), React 19, Tailwind CSS v4, Leaflet.js para mapas, y Supabase como backend (Auth, Database y Realtime).

## Estructura de la Base de Datos (Supabase)
Toda la lógica de datos reside en la BD usando PostgreSQL y está protegida por políticas (RLS).

### Tablas Principales
1. **`profiles`**
   - Se crea automáticamente mediante un *trigger* (`private.handle_new_user`) cuando un usuario se registra en `auth.users`.
   - Contiene el `full_name` que se ingresa en el portal de registro.

2. **`parking_lots`**
   - Registra los estacionamientos en sí: locación geográfica (Lat, Lng y punto en `location` generado automáticamente), nombre, dirección, y tamaño (`small`, `medium`, `large`).
   - El estado de este registro se actualiza automáticamente con cada nuevo "reporte".

3. **`parking_lot_reports`**
   - Sirve como log histórico. Cada que alguien marca un estacionamiento como `empty` (vacío), `half_full` (medio lleno) o `full` (muy lleno), se inserta un registro aquí.
   - Un *trigger* (`private.apply_parking_lot_report`) actualiza el estado en `parking_lots` y alerta mediante Subscripciones Realtime al frontend.

### Políticas de Seguridad (RLS)
- Lectura de estacionamientos y reportes es pública para usuarios autenticados.
- Creación y edición está restringida al usuario que reporta o es dueño de su cuenta.

## Decisiones Técnicas del Frontend
- **Leaflet SSR-Safe:** Debido a que Leaflet depende de la API `window` del navegador, el componente de los mapas (`components/parking-map.tsx`) se carga de forma diferida (`next/dynamic`) marcando explícitamente `ssr: false`.
- **Search Params Promise:** Next.js 15+ requiere que los parámetros dinámicos de URL en el servidor (`searchParams` y `params`) se resuelvan como Promesas (`await props.searchParams`), lo cual se arregló en `/login/page.tsx` para evitar que la aplicación falle (hydration mismatch / sync execution error).
- **Manejo del Estado:** El estado de las ubicaciones del navegador utiliza ahora `useSyncExternalStore` o patrones defensivos en un solo lugar sin causar renders secuenciales e innecesarios que molestaban a StrictMode/ESLint. Realtime es manejado nativamente usando los Channels de `@supabase/ssr`.

## Autenticación
El flujo se maneja de lado del servidor interactuando desde `app/login/actions.ts`:
- Revisa el formulario usando FormData.
- Las credenciales se envían mediante la librería Server-Side de Supabase y crean la 'Cookie' con la sesión respectiva.
- Para el registro de cuentas nuevas, captura explícitamente `full_name` para inyectarlo en `user_meta_data`, lo que el trigger de postgres lee para inicializar la tabla `profiles`.
- Muestra el texto exacto devuelto por Supabase para evitar confusiones de si el error fue por contraseñas muy cortas o por credenciales mal escritas.
