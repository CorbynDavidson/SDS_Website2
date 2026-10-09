import {readFile,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('../build/data.json',import.meta.url),'utf8'));
if(!data.forms||Object.keys(data.forms).length<1)throw new Error('Build the SDS site before packaging its UK intake schemas.');
await writeFile(new URL('../uk-intake/forms.json',import.meta.url),JSON.stringify(data.forms,null,2)+'\n');
console.log('Packaged '+Object.keys(data.forms).length+' SDS form definitions for the UK intake service.');
