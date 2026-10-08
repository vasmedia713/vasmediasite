import {build} from 'esbuild';
await build({entryPoints:['src/auth.mjs'],bundle:true,minify:true,format:'iife',platform:'browser',target:['es2020'],outfile:'assets/js/auth.js',legalComments:'linked'});
