import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {validateOutputRoot} from './output-root.mjs';

const project=path.resolve(import.meta.dirname,'../..');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const relative=(root,p)=>path.relative(root,p).split(path.sep).join('/');
const inside=(root,p)=>{const r=path.relative(root,p);return !r||r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);};
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function walk(dir){
  if(fs.lstatSync(dir).isSymbolicLink())throw Error('Linked documentation input refused');
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    const p=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('Linked documentation input refused: '+e.name);
    return e.isDirectory()?walk(p):e.isFile()?[p]:[];
  });
}
function prose(text){
  let fence=null;const lines=[];
  for(const line of text.replaceAll('\r\n','\n').split('\n')){
    const marker=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
    if(fence){if(marker&&marker[1][0]===fence.char&&marker[1].length>=fence.length&&!marker[2].trim())fence=null;lines.push('');continue;}
    if(marker){fence={char:marker[1][0],length:marker[1].length};lines.push('');continue;}lines.push(line);
  }
  return {text:lines.join('\n'),unclosed_fence:Boolean(fence)};
}
const unescapeMarkdown=value=>value.replace(/\\([ !"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~])/gu,'$1');
function destination(value){
  value=value.trim();if(value.startsWith('<')){const end=value.indexOf('>');return end<0?null:unescapeMarkdown(value.slice(1,end));}
  const match=value.match(/^(?:\\.|[^\s])+/u);return match?unescapeMarkdown(match[0]):null;
}
function linksIn(text){
  const source=text.replace(/(`+)[\s\S]*?\1/gu,''),links=[],definitions=new Map();
  for(const m of source.matchAll(/^ {0,3}\[([^\]]+)\]:\s*(.+)$/gmu)){const to=destination(m[2]);if(to)definitions.set(m[1].trim().replace(/\s+/gu,' ').toLowerCase(),to);}
  // Inline links/images; balanced parentheses also handle filenames such as p(1).md.
  for(const m of source.matchAll(/(?<!\\)\]\(/gu)){
    let end=m.index+2,depth=1,angle=false;
    for(;end<source.length&&depth;end++){const char=source[end];if(char==='\\'){end++;continue;}if(char==='<')angle=true;else if(char==='>')angle=false;else if(!angle&&char==='(')depth++;else if(!angle&&char===')')depth--;}
    if(depth===0){const to=destination(source.slice(m.index+2,end-1));if(to)links.push({url:to,syntax:'inline'});}
  }
  for(const [label,url] of definitions)links.push({url,syntax:'reference-definition',label});
  // Defined shortcut/collapsed/full reference links resolve through the same map.
  for(const m of source.matchAll(/(?<!\\)\[([^\]\n]+)\](?:\[([^\]\n]*)\])?/gu)){
    const label=(m[2]||m[1]).trim().replace(/\s+/gu,' ').toLowerCase();
    if(definitions.has(label))links.push({url:definitions.get(label),syntax:'reference',label});
  }
  return links;
}
function anchorsIn(text){
  const anchors=new Set(),duplicates=new Map();
  for(const m of text.matchAll(/^ {0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/gmu)){
    const title=m[1].replace(/<[^>]*>/gu,'').replace(/\[([^\]]+)\]\([^)]*\)/gu,'$1').replaceAll('`','').replace(/&amp;/gu,'&');
    const slug=title.toLowerCase().replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu,'').replace(/\s/gu,'-'),count=duplicates.get(slug)??0;
    duplicates.set(slug,count+1);anchors.add(slug+(count?'-'+count:''));
  }
  for(const m of text.matchAll(/<(?:a|h[1-6])\b[^>]*\b(?:id|name)\s*=\s*["']([^"']+)["']/giu))anchors.add(m[1]);
  return anchors;
}
function noLinkedTarget(root,target){
  let cursor=root;for(const part of path.relative(root,target).split(path.sep).filter(Boolean)){cursor=path.join(cursor,part);if(fs.lstatSync(cursor).isSymbolicLink())return false;}return true;
}

export function validateDocumentation({root=project}={}){
  root=path.resolve(root);const docs=path.join(root,'docs/git-compat'),reference=path.join(docs,'reference'),historicalPath=path.join(docs,'DOCUMENTATION-VALIDATION.json');
  const historical=readJson(historicalPath),assertions=[],links=[],external=[],markdownCache=new Map();
  const check=(id,passed,details)=>assertions.push({id,passed:Boolean(passed),details});
  const markdown=p=>{if(!markdownCache.has(p))markdownCache.set(p,prose(fs.readFileSync(p,'utf8')));return markdownCache.get(p);};
  const inputs=[path.join(root,'AGENTS.md'),...walk(docs).filter(p=>p.endsWith('.md'))];
  for(const file of inputs){
    const content=markdown(file),historicalRoot=path.dirname(file)===path.join(docs,'history')&&/^AGENTS\.(?:before|after).*\.md$/iu.test(path.basename(file));
    for(const found of linksIn(content.text)){
      const url=found.url;
      if(/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(url)&&!/^file:/iu.test(url)&&!/^\w:[\\/]/u.test(url)){external.push({file:relative(root,file),url});continue;}
      const row={file:relative(root,file),link:url,syntax:found.syntax,context:historicalRoot?'historical-project-root':'document-relative',passed:false};links.push(row);
      try{
        if(/^file:|^[a-z]:[\\/]|^\/|\\/iu.test(url))throw Error('Nonportable local absolute/backslash link');
        const hashAt=url.indexOf('#'),rawPath=hashAt<0?url:url.slice(0,hashAt),anchor=hashAt<0?null:decodeURIComponent(url.slice(hashAt+1)),queryAt=rawPath.indexOf('?');
        const targetPart=decodeURIComponent(queryAt<0?rawPath:rawPath.slice(0,queryAt));
        const target=targetPart?path.resolve(historicalRoot?root:path.dirname(file),targetPart):file;
        if(!inside(root,target))throw Error('Local link escapes project');row.resolved=relative(root,target);
        if(!fs.existsSync(target))throw Error('Missing local link target');if(!noLinkedTarget(root,target))throw Error('Linked local target refused');
        row.anchor_checked=Boolean(anchor&&target.endsWith('.md'));if(row.anchor_checked&&!anchorsIn(markdown(target).text).has(anchor))throw Error('Missing Markdown anchor');
        row.passed=true;
      }catch(error){row.error=error.message;}
    }
  }
  check('local-markdown-links-and-anchors',links.every(l=>l.passed),{checked:links.length,broken:links.filter(l=>!l.passed)});
  check('closed-markdown-fences',[...markdownCache.values()].every(v=>!v.unclosed_fence),[...markdownCache].filter(([,v])=>v.unclosed_fence).map(([p])=>relative(root,p)));
  const expected=historical.reference_files;
  if(!Array.isArray(expected)||expected.length!==19||new Set(expected.map(e=>e.path)).size!==19||expected.some(e=>typeof e.path!=='string'||e.path.includes('\\')||e.path.split('/').some(p=>!p||p==='.'||p==='..')||path.isAbsolute(e.path)||!/^[0-9a-f]{64}$/u.test(e.source_sha256)||e.source_sha256!==e.copy_sha256))throw Error('Historical reference hash baseline is missing or malformed');
  const actualReference=walk(reference).map(p=>relative(reference,p));
  const referenceFiles=expected.map(e=>{const p=path.join(reference,e.path);return {path:e.path,expected_sha256:e.source_sha256,actual_sha256:fs.existsSync(p)?hash(fs.readFileSync(p)):null};});
  check('original-reference-19-byte-preserved',actualReference.length===19&&actualReference.every(p=>expected.some(e=>e.path===p))&&referenceFiles.every(f=>f.actual_sha256===f.expected_sha256),referenceFiles);
  const original=readJson(path.join(reference,'03-Cenarios-Git-Layers-v2.json')).scenarios,workingPath=path.join(root,'tests/git-compat/scenarios.json'),workingDocument=readJson(workingPath),working=Array.isArray(workingDocument)?workingDocument:workingDocument.scenarios;
  if(!Array.isArray(original)||!Array.isArray(working))throw Error('Scenario matrices must contain arrays');
  const originalIds=original.map(s=>s.id),ids=working.map(s=>s.id);
  check('original-matrix-344-unique',originalIds.length===344&&new Set(originalIds).size===344,{count:originalIds.length});
  check('working-matrix-ids-valid-unique',ids.every(id=>typeof id==='string'&&/^[A-Z]+-\d{3,}$/u.test(id))&&new Set(ids).size===ids.length,{count:ids.length});
  check('original-ids-preserved-in-extensible-matrix',originalIds.every(id=>ids.includes(id)),{original:originalIds.length,working:ids.length,added:ids.filter(id=>!originalIds.includes(id)),missing:originalIds.filter(id=>!ids.includes(id))});
  const files=[...new Set([...inputs,historicalPath,workingPath,...walk(reference)])].sort(),manifest=files.map(p=>({path:relative(root,p),sha256:hash(fs.readFileSync(p)),bytes:fs.statSync(p).size}));
  const old=new Map((historical.manifest??[]).map(f=>[f.path,f.sha256]));
  const historicalDocumentChanges=manifest.filter(f=>f.path.startsWith('docs/git-compat/')&&!f.path.endsWith('/DOCUMENTATION-VALIDATION.json')).map(f=>({path:f.path,change:!old.has(f.path)?'ADDED_SINCE_HISTORICAL_AUDIT':old.get(f.path)!==f.sha256?'CHANGED_SINCE_HISTORICAL_AUDIT':'SAME'})).filter(f=>f.change!=='SAME');
  return {schema_version:'1.0',checked_at:new Date().toISOString(),status:assertions.every(a=>a.passed)?'PASS':'FAIL',scope:'Read-only current documentation validation; no Git command, product execution or external URL request',assertions,links,external_links_not_requested:external.length,reference_files:referenceFiles,matrix:{original_ids:originalIds.length,current_ids:ids.length},historical_baseline:{path:relative(root,historicalPath),sha256:hash(fs.readFileSync(historicalPath)),checked_at:historical.checked_at,role:'Immutable reference-byte baseline; historical document hashes are informational, not a veto on authorized evolution.'},historical_document_changes:historicalDocumentChanges,input_manifest:manifest,limits:['Markdown inline/image/reference links, ATX headings with duplicate suffixes, and explicit HTML id/name anchors are checked; this is not a complete CommonMark/HTML renderer.','Fenced and inline code are ignored; external URLs and non-Markdown fragment semantics are not requested or certified.','Reference equality is relative to the retained historical hash baseline, not an independent signature or a fresh read of the private ZIP extraction.','Only original scenario ID preservation and current ID uniqueness are checked here; full matrix schema, cases, behavior and product support belong to the runner.','Historical AGENTS before/after snapshots resolve relative links in the original project-root context. The historical validation JSON is never rewritten.']};
}

export function docsOptions(args){
  const options={};for(let i=0;i<args.length;i++){
    if(args[i]==='--help'&&!options.help){options.help=true;continue;}
    if(args[i]!=='--out'||options.out!==undefined||!args[i+1]||args[i+1].startsWith('--'))throw Error('Usage: docs.mjs [--out NEW_JSON_FILE] [--help]');options.out=args[++i];
  }return options;
}
export function writeDocumentationResult(filename,result){
  const target=path.resolve(filename);
  validateOutputRoot(path.dirname(target),{projectRoot:project,label:'--out parent'});
  for(const name of ['docs','src','scripts','tests','node_modules','.git','dist','dist-debug'])if(inside(path.join(project,name),target))throw Error('--out must stay outside documentation/source/dependency/Git trees');
  if(fs.existsSync(target))throw Error('Documentation output must be a new path');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(result,null,2)+'\n',{flag:'wx'});return target;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{const options=docsOptions(process.argv.slice(2));if(options.help)console.log('Read-only local Markdown/reference/matrix checks. docs.mjs [--out NEW_JSON_FILE]; default stdout; never rewrites historical audit.');else{
    const result=validateDocumentation();if(options.out){const output=writeDocumentationResult(options.out,result);console.log(JSON.stringify({status:result.status,checks:result.assertions.length,links:result.links.length,reference_files:result.reference_files.length,matrix:result.matrix,output},null,2));}else console.log(JSON.stringify(result,null,2));process.exitCode=result.status==='PASS'?0:1;
  }}catch(error){console.error(JSON.stringify({status:'ERROR',error:error.message}));process.exitCode=2;}
}
