import pg from 'pg';
import {S3Client,PutObjectCommand,DeleteObjectCommand,GetBucketLocationCommand} from '@aws-sdk/client-s3';

export function createRepository({databaseUrl,bucket,region='eu-west-2'}){
  if(region!=='eu-west-2')throw new Error('UK intake must run in the London AWS Region.');
  if(!databaseUrl||!bucket)throw new Error('Database and private evidence bucket are required.');
  if(!new URL(databaseUrl).hostname.endsWith('.eu-west-2.rds.amazonaws.com'))throw new Error('Database endpoint must be in AWS London.');
  if(!process.env.RDS_CA_CERT_PEM)throw new Error('The RDS CA certificate is required for database TLS.');
  const pool=new pg.Pool({connectionString:databaseUrl,max:5,ssl:{rejectUnauthorized:true,ca:process.env.RDS_CA_CERT_PEM}});
  const s3=new S3Client({region});
  return {
    async close(){await pool.end();},
    async health(){
      const location=await s3.send(new GetBucketLocationCommand({Bucket:bucket}));
      if(location.LocationConstraint!=='eu-west-2')throw new Error('Evidence bucket must be in AWS London.');
      await pool.query('SELECT 1');
    },
    async findAddresses({postcode,rateKey,expiresAt}){
      const client=await pool.connect();
      try{
        await client.query('BEGIN');
        const status=await client.query("SELECT 1 FROM address_dataset_state WHERE id=1 AND active=true AND address_count>0");
        if(!status.rows.length){const error=new Error('Address directory is not licensed and loaded.');error.code='ADDRESS_UNAVAILABLE';throw error;}
        const rate=await client.query('INSERT INTO submission_rate_limits(bucket_key,count,expires_at) VALUES($1,1,$2) ON CONFLICT(bucket_key) DO UPDATE SET count=submission_rate_limits.count+1 RETURNING count',[rateKey,expiresAt]);
        if(rate.rows[0].count>60){const error=new Error('Rate limit');error.code='RATE_LIMIT';throw error;}
        const result=await client.query('SELECT address_id,line_1,line_2,post_town,postcode FROM address_directory WHERE postcode_normalized=$1 ORDER BY line_1,line_2 LIMIT 100',[postcode]);
        await client.query('COMMIT');
        return result.rows.map(row=>({id:row.address_id,line1:row.line_1,line2:row.line_2,town:row.post_town,postcode:row.postcode}));
      }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
    },
    async submit({requestKey,formKey,sourcePath,fields,files,rateKey,expiresAt}){
      const client=await pool.connect(),uploaded=[];
      try{
        await client.query('BEGIN');
        const existing=await client.query('SELECT id FROM form_submissions WHERE request_key=$1',[requestKey]);
        if(existing.rows.length){await client.query('COMMIT');return {id:existing.rows[0].id,duplicate:true};}
        const rate=await client.query('INSERT INTO submission_rate_limits(bucket_key,count,expires_at) VALUES($1,1,$2) ON CONFLICT(bucket_key) DO UPDATE SET count=submission_rate_limits.count+1 RETURNING count',[rateKey,expiresAt]);
        if(rate.rows[0].count>20){const error=new Error('Rate limit');error.code='RATE_LIMIT';throw error;}
        const inserted=await client.query('INSERT INTO form_submissions(request_key,form_key,source_path,payload_json) VALUES($1,$2,$3,$4) ON CONFLICT(request_key) DO NOTHING RETURNING id',[requestKey,formKey,sourcePath,JSON.stringify(fields)]);
        if(!inserted.rows.length){const row=await client.query('SELECT id FROM form_submissions WHERE request_key=$1',[requestKey]);await client.query('COMMIT');return {id:row.rows[0].id,duplicate:true};}
        const id=inserted.rows[0].id;
        for(const file of files){
          await s3.send(new PutObjectCommand({Bucket:bucket,Key:file.storageKey,Body:file.bytes,ContentType:file.type,ServerSideEncryption:'AES256'}));
          uploaded.push(file.storageKey);
          await client.query('INSERT INTO form_uploads(id,submission_id,storage_key,filename,content_type,bytes) VALUES($1,$2,$3,$4,$5,$6)',[file.id,id,file.storageKey,file.name,file.type,file.bytes.byteLength]);
        }
        await client.query('COMMIT');
        return {id};
      }catch(error){
        await client.query('ROLLBACK').catch(()=>{});
        await Promise.allSettled(uploaded.map(Key=>s3.send(new DeleteObjectCommand({Bucket:bucket,Key}))));
        throw error;
      }finally{client.release();}
    }
  };
}
