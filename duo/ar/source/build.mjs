import { build } from '../../source/node_modules/esbuild/lib/main.js';
import { fileURLToPath } from 'node:url';
const here=fileURLToPath(new URL('.',import.meta.url));
await build({entryPoints:[here+'main.js'],bundle:true,minify:true,format:'esm',target:'es2022',outfile:here+'../app.js',nodePaths:[fileURLToPath(new URL('../../source/node_modules',import.meta.url))]});
