import { build } from 'esbuild';
const bundled = await build({entryPoints:[new URL('./contact-validation.mjs',import.meta.url).pathname],bundle:true,write:false,format:'iife',globalName:'SdsContactValidation',platform:'browser',target:'es2022',minify:true});
export const contactBundle=bundled.outputFiles[0].text;
export const embedContactValidation = runtime => contactBundle+'\n'+runtime.replace("import { validateContact } from '../scripts/lib/contact-validation.mjs';",'const { validateContact } = SdsContactValidation;');
