import {readFile} from 'node:fs/promises';
const gates=JSON.parse(await readFile(new URL('../config/release-gates.json',import.meta.url),'utf8'));
const failed=Object.entries(gates).filter(([,value])=>value!==true).map(([key])=>key);
if(failed.length)throw new Error('Production cutover is blocked by: '+failed.join(', '));
console.log('All production release gates are signed off.');
