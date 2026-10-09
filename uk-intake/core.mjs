import {createHmac,randomUUID} from 'node:crypto';

const MAX_JSON_BYTES=131072;
const MAX_FILE_BYTES=8*1024*1024;
const MAX_FILES=5;
const allowedTypes={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',mov:'video/quicktime',mpeg:'video/mpeg',mpg:'video/mpeg'};
const response=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});

export function fileType(bytes){
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return 'image/png';
  if(String.fromCharCode(...bytes.slice(0,6)).startsWith('GIF8'))return 'image/gif';
  if(String.fromCharCode(...bytes.slice(4,8))==='ftyp')return 'video/quicktime';
  if(bytes[0]===0&&bytes[1]===0&&bytes[2]===1)return 'video/mpeg';
  return null;
}

export function validateSubmission(definition,payload,attachments=[]){
  if(!definition||!payload||typeof payload!=='object'||!payload.fields||typeof payload.fields!=='object'||Array.isArray(payload.fields))return {error:'Invalid form.'};
  const {fields,sourcePath,requestKey}=payload;
  if(!/^[a-zA-Z0-9_-]{16,80}$/.test(requestKey||''))return {error:'Please reload the form and try again.'};
  if(!definition.sourcePaths.includes(sourcePath))return {error:'The source page is invalid.'};
  if(attachments.length>MAX_FILES||attachments.some(file=>file.size>MAX_FILE_BYTES))return {error:'Please choose a maximum of 5 files, each up to 8 MB.'};
  if(attachments.length&&!definition.attachments)return {error:'File uploads are unavailable for this form.'};
  if(definition.isWizard&&definition.fields.some(field=>field.name.startsWith('disrepair_type['))&&!Object.entries(fields).some(([name,value])=>name.startsWith('disrepair_type[')&&value))return {error:'Please check at least one box.'};
  const cleaned={};
  for(const field of definition.fields){
    const raw=fields[field.name];
    const value=Array.isArray(raw)?raw.map(item=>String(item).trim()):String(raw??'').trim();
    const plain=Array.isArray(value)?value.join(', '):value;
    if(plain.length>(field.tag==='textarea'?20000:1000))return {error:field.label+': this response is too long.'};
    if(field.required&&!plain)return {error:'Please complete '+field.label.replace(/\s*\*/g,'')+'.'};
    if(field.type==='email'&&plain&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(plain))return {error:'Please enter a valid email address.'};
    if(field.type==='tel'&&plain&&!/^\+?[\d\s().-]{10,25}$/.test(plain))return {error:'Please enter a valid phone number.'};
    if(/postcode/i.test(field.label)&&plain&&!/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(plain))return {error:'Please enter a full UK postcode.'};
    if(field.options.length&&plain&&![].concat(value).every(item=>field.options.some(option=>option.value===item)))return {error:'Please choose a listed option for '+field.label.replace(/\s*\*/g,'')+'.'};
    cleaned[field.name]={label:field.label,value,displayValue:field.options.length?[].concat(value).map(item=>field.options.find(option=>option.value===item)?.label||item).join(', '):plain};
  }
  return {fields:cleaned};
}

export function createIntake({forms,origin,rateLimitSecret,repository}){
  if(!/^https:\/\/[^/]+$/.test(origin)||!rateLimitSecret||!repository)throw new Error('Intake configuration is incomplete.');
  return async function handle(request,clientIp='unknown'){
    const url=new URL(request.url);
    const cors={'access-control-allow-origin':origin,'vary':'Origin'};
    if(request.headers.get('origin')!==origin)return response({error:'Please submit from this website.'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...cors,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'600'}});
    if(request.method==='POST'&&url.pathname==='/api/contact-check'){
      let details;
      try{const body=await request.text();if(Buffer.byteLength(body)>2048)throw new Error('too-large');details=JSON.parse(body);}catch{return response({error:'Invalid contact details.'},400,cors);}
      if(!details||!['email','postcode'].includes(details.type)||typeof details.value!=='string'||details.value.length>254)return response({error:'Invalid contact details.'},400,cors);
      const value=details.value.trim();
      if(!value)return response({status:'unknown'},200,cors);
      const valid=details.type==='email'?/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value):/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(value);
      return response(valid?{status:'unknown'}:{status:'invalid',message:details.type==='email'?'Please enter a valid email address.':'Please enter a full UK postcode.'},200,cors);
    }
    if(request.method!=='POST'||!url.pathname.startsWith('/api/forms/'))return response({error:'Not found.'},404,cors);
    const definition=forms[url.pathname.slice('/api/forms/'.length)];
    if(!definition)return response({error:'This form is unavailable.'},404,cors);
    let payload,attachments=[];
    try{
      if((request.headers.get('content-type')||'').includes('multipart/form-data')){
        const form=await request.formData();
        payload=JSON.parse(form.get('payload'));
        attachments=form.getAll('attachments').filter(file=>typeof file!=='string');
        if(JSON.stringify(payload).length>MAX_JSON_BYTES)throw new Error('Too large');
      }else{
        const body=await request.text();
        if(Buffer.byteLength(body)>MAX_JSON_BYTES)throw new Error('Too large');
        payload=JSON.parse(body);
      }
    }catch{return response({error:'Please check the form and use a maximum of 5 files, each up to 8 MB.'},400,cors);}
    if(payload&&Object.hasOwn(payload.fields||{},'company')&&String(payload.fields.company).trim())return response({ok:true,redirect:'/contact-us/thank-you/'},201,cors);
    const valid=validateSubmission(definition,payload,attachments);
    if(valid.error)return response(valid,400,cors);
    const files=[];
    for(const file of attachments){
      const bytes=new Uint8Array(await file.arrayBuffer());
      const extension=file.name.split('.').pop().toLowerCase(),type=fileType(bytes);
      if(!type||allowedTypes[extension]!==type)return response({error:'Please upload JPG, PNG, GIF, MOV or MPEG files.'},400,cors);
      files.push({id:randomUUID(),bytes,name:file.name.replace(/[\x00-\x1f"\\/]/g,'_').slice(0,180),type,storageKey:'enquiry-uploads/'+randomUUID()});
    }
    if(files.length)valid.fields._attachments={label:'Upload images of your issue (maximum 5)',value:files.map(file=>({id:file.id,name:file.name})),displayValue:files.map(file=>file.name).join(', ')};
    const hour=Math.floor(Date.now()/3600000);
    const rateKey=createHmac('sha256',rateLimitSecret).update(hour+':'+clientIp).digest('hex');
    try{
      const result=await repository.submit({requestKey:payload.requestKey,formKey:definition.key,sourcePath:payload.sourcePath,fields:valid.fields,files,rateKey,expiresAt:(hour+2)*3600000});
      return response({ok:true,id:result.id,duplicate:result.duplicate||false,redirect:'/contact-us/thank-you/'},result.duplicate?200:201,cors);
    }catch(error){
      if(error.code==='RATE_LIMIT')return response({error:'Please wait before sending another enquiry.'},429,{...cors,'retry-after':'3600'});
      return response({error:'The enquiry service is temporarily unavailable.'},503,cors);
    }
  };
}
