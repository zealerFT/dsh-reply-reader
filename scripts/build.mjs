import {build} from 'esbuild';
await build({entryPoints: ['client/index.jsx'], outfile: 'lib/client.js', format: 'cjs', target: 'es2022', platform: 'browser', bundle: true, minify: true,
  external: ['react', 'react-dom'], loader: {'.css': 'text'},
  banner: {js: 'window.__ModuleLoader__.load({id:"dsh-reply-reader",factory:require=>{const module={exports:{}};const exports=module.exports;'},
  footer: {js: 'return module.exports;}});'},
});
