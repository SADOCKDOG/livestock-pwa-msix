/**
 * app-version.js — FUENTE ÚNICA de versión de la aplicación.
 * Al publicar una versión nueva: actualizar AQUÍ y en package.json (mismo valor).
 * versionCode debe superar siempre al último subido a Play Console.
 * La versión de base de datos NO se declara aquí: sale de DB_VERSION (js/db.js).
 */
window.APP_INFO = Object.freeze({
  version: '4.9.0',
  versionCode: 515
});
