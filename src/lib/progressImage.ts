export function photoPath(userId:string,id:string){if(!/^[0-9a-f-]{36}$/i.test(userId)||!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Caminho inválido.');return `${userId}/${id}.jpg`;}
/** Fresh canvas exports pixels only; original EXIF/GPS never uploaded. */
export async function prepareProgressImage(file:File):Promise<Blob>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw new Error('Use JPEG, PNG ou WebP de até 20 MB.');
 const url=URL.createObjectURL(file);
 try{const image=new Image();image.src=url;await image.decode();if(!image.width||!image.height)throw new Error('Foto inválida.');const canvas=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(image.width,image.height));canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível preparar a foto.');ctx.drawImage(image,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.8));if(!blob||blob.size>1500000)throw new Error('A foto preparada excede 1,5 MB. Escolha uma foto menor.');return blob;}finally{URL.revokeObjectURL(url);}
}
