/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import { workerData } from 'node:worker_threads';
import type { ESMInMemoryFileLoaderWorkerData } from './esm-in-memory-loader/loader-hooks';
import { patchFetchToLoadInMemoryAssets } from './fetch-patch';
import { loadEsmModuleFromMemory } from './load-esm-from-memory';

export interface RoutesExtractorWorkerData extends ESMInMemoryFileLoaderWorkerData {
  document: string;
  verbose: boolean;
  assetFiles: Record</** Destination */ string, /** Source */ string>;
}

export interface RoutersExtractorWorkerResult {
  routes: string[];
  warnings?: string[];
}

/**
 * This is passed as workerData when setting up the worker via the `piscina` package.
 */
const { document, verbose } = workerData as RoutesExtractorWorkerData;

/** Renders an application based on a provided options. */
async function extractRoutes(): Promise<RoutersExtractorWorkerResult> {
  const { ɵgetRoutesFromAngularRouterConfig: getRoutesFromAngularRouterConfig } =
    await loadEsmModuleFromMemory('./render-utils.server.mjs');
  const { default: bootstrapAppFnOrModule } = await loadEsmModuleFromMemory('./main.server.mjs');

  const skippedRedirects: string[] = [];
  const skippedOthers: string[] = [];
  const routes: string[] = [];

  const { routes: extractRoutes } = await getRoutesFromAngularRouterConfig(
    bootstrapAppFnOrModule,
    document,
    new URL('http://localhost'),
  );

  for (const { route, redirectTo } of extractRoutes) {
    if (redirectTo !== undefined) {
      skippedRedirects.push(route);
    } else if (/[:*]/.test(route)) {
      skippedOthers.push(route);
    } else {
      routes.push(route);
    }
  }

  if (!verbose) {
    return { routes };
  }

  let warnings: string[] | undefined;
  if (skippedOthers.length) {
    (warnings ??= []).push(
      'The following routes were skipped from prerendering because they contain routes with dynamic parameters:\n' +
        skippedOthers.join('\n'),
    );
  }

  if (skippedRedirects.length) {
    (warnings ??= []).push(
      'The following routes were skipped from prerendering because they contain redirects:\n',
      skippedRedirects.join('\n'),
    );
  }

  return { routes, warnings };
}

function initialize() {
  patchFetchToLoadInMemoryAssets();

  return extractRoutes;
}

export default initialize();
