const searchEndpoint='https://api.perplexity.ai/search';
const agentEndpoint='https://api.perplexity.ai/v1/agent';
const fail=()=>Object.assign(new Error('Travel research is temporarily unavailable. Please try again.'),{status:502});
async function post(url,config,body) {
  let response;
  try {response=await (config.fetch||fetch)(url,{method:'POST',signal:AbortSignal.timeout(240000),headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(body)});}catch{throw fail();}
  if(!response.ok){if(response.status===401||response.status===403)throw Object.assign(new Error('The travel research provider rejected its credentials or feature access.'),{status:503});throw fail();}
  try{return await response.json();}catch{throw fail();}
}

// Search is evidence retrieval only. It does not synthesize an answer.
export async function perplexitySearch(query,config) {
  const result=await post(searchEndpoint,{...config,apiKey:config.searchApiKey||config.apiKey},{query:String(query).slice(0,12000),max_results:10,search_type:'web',search_context_size:'high'});
  return (Array.isArray(result.results)?result.results:[]).slice(0,20).flatMap(item=>{
    let url;try{url=new URL(item.url).href;if(!['http:','https:'].includes(new URL(url).protocol))return [];}catch{return [];}
    return [{title:String(item.title||url).slice(0,300),url,snippet:String(item.snippet||'').slice(0,3000),date:String(item.date||'').slice(0,50),last_updated:String(item.last_updated||'').slice(0,50)}];
  });
}

// Perplexity generation uses its current Agent API; Search API is never used as generation.
export async function perplexityAnswer(prompt,config,{search=true,deep=false}={}) {
  const input=search?`${prompt}\n\nUse current web research and cite the sources for all changing travel facts. Prefer primary sources.`:prompt;
  const result=await post(agentEndpoint,config,{preset:deep?'high':'fast',model:deep?(config.deepModel||config.model):config.model,input,max_output_tokens:deep?12000:5000,...(search?{tools:[{type:'web_search'}]}:{})});
  const texts=[],sources=[];
  for(const item of result.output||[]) {
    if(item.type==='message')for(const c of item.content||[]) {
      if(c.type==='output_text'||c.type==='text')texts.push(c.text||'');
      for(const annotation of c.annotations||[])if(annotation.type==='url_citation'||annotation.url)sources.push({title:annotation.title||annotation.url,url:annotation.url});
    }
    if(['search_results','fetch_url_results'].includes(item.type))for(const source of item.results||item.contents||[])sources.push({title:source.title,url:source.url});
  }
  // output_text is an SDK convenience property; raw REST responses carry output[].
  if(typeof result.output_text==='string'&&!texts.length)texts.push(result.output_text);
  for(const source of result.citations||[])sources.push(typeof source==='string'?{url:source,title:source}:{title:source.title,url:source.url});
  const text=texts.join('\n').trim();if(!text)throw fail();
  if(result.status&&result.status!=='completed')throw fail();
  return {text,sources:sources.filter(s=>s.url)};
}
