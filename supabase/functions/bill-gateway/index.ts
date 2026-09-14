import { createClient } from "npm:@supabase/supabase-js@2.116.0";
const secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const db = createClient(Deno.env.get("SUPABASE_URL")!, secret!, { auth: { persistSession: false, autoRefreshToken: false } });
const headers = { "Cache-Control": "private, no-store", "Content-Type": "application/json", "Referrer-Policy": "no-referrer" };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
Deno.serve(async (req) => {
 try {
  if (!["GET","POST"].includes(req.method)) return reply({error:"ไม่รองรับคำขอ"},405);
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) return reply({error:"ไม่พบบิลหรือลิงก์หมดอายุ"},404);
  const {data:i,error} = await db.from("invoices").select("*").eq("token",token).gt("token_expires_at",new Date().toISOString()).not("status","in","(draft,void)").maybeSingle();
  if(error) throw error;
  if(!i) return reply({error:"ไม่พบบิลหรือลิงก์หมดอายุ"},404);
  if(req.method==="GET"){
   const {data:items,error:ie}=await db.from("invoice_items").select("label,kind,quantity,rate,amount,previous_reading,current_reading").eq("invoice_id",i.id).order("position");
   if(ie) throw ie;
   return reply({property_name:i.property_name,room_name:i.room_name,tenant_name:i.tenant_name,month:i.month,due_date:i.due_date,status:i.status,total:i.total,payment_info:i.payment_info,paid_at:i.paid_at,items});
  }
  if(!["issued","overdue","slip_submitted"].includes(i.status)) return reply({error:"บิลนี้ไม่รับสลิปแล้ว"},409);
  if(Number(req.headers.get("content-length")||0)>5500000) return reply({error:"ไฟล์ต้องไม่เกิน 5 MB"},413);
  const {count,error:ce}=await db.from("payment_submissions").select("id",{head:true,count:"exact"}).eq("invoice_id",i.id).gt("created_at",new Date(Date.now()-3600000).toISOString());
  if(ce) throw ce;
  if((count||0)>=5) return reply({error:"ส่งสลิปบ่อยเกินไป กรุณารอ 1 ชั่วโมง"},429);
  const reader=req.body?.getReader(); if(!reader) return reply({error:"กรุณาเลือกสลิป"},400);
  const chunks:Uint8Array[]=[]; let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>5500000){await reader.cancel();return reply({error:"ไฟล์ต้องไม่เกิน 5 MB"},413);}chunks.push(part.value);}
  const body=new Uint8Array(size);let offset=0;for(const part of chunks){body.set(part,offset);offset+=part.length;}
  const form=await new Response(body,{headers:{"Content-Type":req.headers.get("content-type")||""}}).formData();
  const file=form.get("file");if(!(file instanceof File)||file.size===0||file.size>5242880) return reply({error:"เลือกภาพสลิปขนาดไม่เกิน 5 MB"},400);
  const bytes=new Uint8Array(await file.arrayBuffer());
  const png=bytes.length>8&&[137,80,78,71,13,10,26,10].every((v,j)=>bytes[j]===v);
  const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const webp=new TextDecoder().decode(bytes.slice(0,4))==="RIFF"&&new TextDecoder().decode(bytes.slice(8,12))==="WEBP";
  const mime=png?"image/png":jpg?"image/jpeg":webp?"image/webp":null;
  if(!mime||file.type!==mime)return reply({error:"รองรับเฉพาะภาพ JPG, PNG หรือ WebP"},400);
  const path=i.owner_id+"/"+i.id+"/"+crypto.randomUUID()+(png?".png":jpg?".jpg":".webp");
  const {error:ue}=await db.storage.from("slips").upload(path,bytes,{contentType:mime,upsert:false});if(ue)throw ue;
  const {error:se}=await db.rpc("submit_slip",{bill_token:token,object_path:path});
  if(se){await db.storage.from("slips").remove([path]);return reply({error:"บิลเปลี่ยนสถานะหรือส่งสลิปเกินกำหนด กรุณาโหลดใหม่"},409);}
  return reply({ok:true});
 }catch(e){console.error("bill-gateway", e instanceof Error?e.message:"request failed");return reply({error:"ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง"},500);}
});

