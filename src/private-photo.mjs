import {createHash} from 'node:crypto';
/** Inject an approved server-only Supabase Storage client and actual decode/scan.
 * This module never reads a key or enables a bucket. Fixture clients are used in tests.
 */
export class PrivatePhotoAdapter {
 constructor({storage,bucket,decodeAndScan}){if(!/^[a-z0-9-]+$/.test(bucket)||typeof decodeAndScan!=='function')throw Error('Private adapter configuration required');Object.assign(this,{storage,bucket,decodeAndScan});}
 async prepare(manifest){const {data,error}=await this.storage.from(this.bucket).createSignedUploadUrl(manifest.object_key,{upsert:false});if(error||!data?.signedUrl)throw Error('Upload not prepared');return {id:manifest.id,status:'pending',signedUrl:data.signedUrl};}
 async verify(manifest){
  const {data,error}=await this.storage.from(this.bucket).download(manifest.object_key);
  if(error||!data||data.size!==manifest.size||data.size>10000000)throw Error('Stored bytes unverified');
  const bytes=new Uint8Array(await data.arrayBuffer());
  const starts=(...signature)=>signature.every((v,i)=>bytes[i]===v);
  const mime=starts(255,216,255)?'image/jpeg':starts(137,80,78,71,13,10,26,10)?'image/png':starts(82,73,70,70)&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
  if(mime!==manifest.mime||createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw Error('Stored bytes mismatch');
  if(await this.decodeAndScan(bytes,mime)!==true)throw Error('Image decoding/safety unverified');
  return {...manifest,safe:true};
 }
}
