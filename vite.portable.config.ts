import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';

export default defineConfig({
 plugins:[react()],
 resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},
 css:{postcss:{plugins:[tailwindcss()]}},
 publicDir:false,
 define:{'process.env.NODE_ENV':JSON.stringify('production')},
 build:{outDir:'.portable-build',emptyOutDir:true,lib:{entry:'portable-entry.tsx',name:'EmberRealm',formats:['iife'],fileName:()=> 'game.js',cssFileName:'game'},rollupOptions:{output:{inlineDynamicImports:true}}}
});
