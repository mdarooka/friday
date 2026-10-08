const endpoint='https://api.anthropic.com/v1/messages';
const supportedEfforts=new Set(['low','medium','high','xhigh','max']);
const safeError=()=>Object.assign(new Error('Travel research is temporarily unavailable. Please try again.'),{status:502});
const citationsFrom=block=>(block.citations||[]).map(c=>({title:c.title||c.cited_text||c.url,url:c.url}));
export async function claudeMessage({prompt,config,web=false,deep=false,image}) {
  if(config.effort && !supportedEfforts.has(config.effort)) {
    throw Object.assign(new Error('AI_EFFORT must be one of: low, medium, high, xhigh, max.'),{status:500});
  }
  const content=[];
  if(image) {
    const match=image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
    if(match)content.push({type:'image',source:{type:'base64',media_type:`image/${match[1]}`,data:match[2]}});
  }
  content.push({type:'text',text:prompt});
  const body={model:deep?(config.deepModel||config.model):config.model,max_tokens:deep?12000:5000,messages:[{role:'user',content}]};
  if(config.effort)body.output_config={effort:config.effort};
  if(web)body.tools=[{type:'web_search_20250305',name:'web_search',max_uses:5}];
  let response;
  try { response=await (config.fetch||fetch)(endpoint,{method:'POST',signal:AbortSignal.timeout(240000),headers:{'x-api-key':config.apiKey,'anthropic-version':'2023-06-01','content-type':'application/json'},body:JSON.stringify(body)}); } catch { throw safeError(); }
  if(!response.ok) {
    if(response.status===401||response.status===403)throw Object.assign(new Error('The travel research provider rejected its credentials or feature access.'),{status:503});
    throw safeError();
  }
  let result;try{result=await response.json();}catch{throw safeError();}
  if(result.stop_reason==='max_tokens')throw Object.assign(new Error('Research exceeded its output limit. Try a more focused request.'),{status:502});
  const texts=[],sources=[];
  for(const block of result.content||[]) {
    if(block.type==='text'){texts.push(block.text||'');sources.push(...citationsFrom(block));}
    if(block.type==='web_search_tool_result')for(const r of block.content||[])if(r.url)sources.push({title:r.title,url:r.url});
    if(block.type==='refusal')throw Object.assign(new Error('Friday could not complete this request. Try a different travel question.'),{status:422});
  }
  const text=texts.join('\n').trim();if(!text)throw safeError();
  return {text,sources};
}

/* Claude has no JSON-mode flag: prompts ask for JSON only, and this strips code fences or stray prose before parsing. */
export function parseJsonText(text) {
  const raw=String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try { return JSON.parse(raw); } catch {
    const start=raw.indexOf('{'),end=raw.lastIndexOf('}');
    if(start<0||end<=start)throw new Error('Response is not JSON');
    return JSON.parse(raw.slice(start,end+1));
  }
}

export function parsePlan(text) {
  const clean=String(text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  const plan=parseJsonText(clean);
  if(!plan||typeof plan!=='object'||Array.isArray(plan))throw new Error('Invalid plan');
  return {text:typeof plan.text==='string'?plan.text:'',days:Array.isArray(plan.days)?plan.days:[],places:Array.isArray(plan.places)?plan.places:[],questions:Array.isArray(plan.questions)?plan.questions:[]};
}
