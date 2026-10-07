// OpenAI Responses API. Credentials and provider calls stay on Friday's server.
export async function openaiMessage({prompt,config={},web=false,deep=false,image,json=false}) {
  if(!config.apiKey||!config.model)throw Object.assign(new Error('OpenAI travel research is not configured.'),{status:503});
  const content=[{type:'input_text',text:prompt}];
  if(image)content.push({type:'input_image',image_url:image});
  const body={model:deep?(config.deepModel||config.model):config.model,store:false,input:[{role:'user',content}],max_output_tokens:deep?16000:5000};
  if(web)body.tools=[{type:'web_search'}];
  if(json)body.text={format:{type:'json_object'}};
  let response;
  try{response=await(config.fetch||fetch)('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(240000)});}catch{throw Object.assign(new Error('OpenAI research could not finish. Please try again.'),{status:502});}
  if(!response.ok)throw Object.assign(new Error('OpenAI travel research is unavailable. Check the server provider configuration.'),{status:response.status===401||response.status===403?503:502});
  const result=await response.json();
  if(result.status&&result.status!=='completed')throw Object.assign(new Error('Research was incomplete. Please try a more focused request.'),{status:502});
  const texts=[],sources=[];
  for(const item of result.output||[])for(const part of item.content||[]){
    if(part.type==='refusal')throw Object.assign(new Error('Friday could not complete this travel request.'),{status:422});
    if(part.type==='output_text'){texts.push(part.text||'');for(const a of part.annotations||[])if(a.type==='url_citation'&&a.url)sources.push({title:a.title||a.url,url:a.url});}
  }
  if(!texts.length)throw Object.assign(new Error('Research returned no usable answer.'),{status:502});
  return {text:texts.join('\n'),sources};
}
