import initSqlJs, { SqlJsStatic } from 'sql.js';

let promise: Promise<SqlJsStatic> | null = null;

/**
 * Грузит sql.js WASM в браузере. Файл sql-wasm.wasm копируется в корень
 * сборки через copy-webpack-plugin (см. webpack.web.config.js), поэтому
 * locateFile отдаёт абсолютный путь от корня сайта.
 */
export function loadSqlJs(): Promise<SqlJsStatic> {
  if (!promise) {
    promise = initSqlJs({ locateFile: (file: string) => `/${file}` });
  }
  return promise;
}
