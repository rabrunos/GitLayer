import fs from 'node:fs';
import path from 'node:path';

export const protectedOutputDirectories=Object.freeze(['src','scripts','tests','docs','node_modules','.git','dist','dist-debug']);
const inside=(root,target)=>{const rel=path.relative(root,target);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};
export function validateOutputRoot(candidate,{projectRoot,label='--out'}={}) {
  const reject=reason=>{throw Object.assign(Error(label+' '+reason),{code:'OUTPUT_ROOT_INVALID'});};
  if(typeof candidate!=='string'||!candidate.trim()||typeof projectRoot!=='string'||!path.isAbsolute(projectRoot))reject('requires a path and an absolute projectRoot');
  const resolved=path.resolve(candidate),project=path.resolve(projectRoot);
  for(const directory of protectedOutputDirectories)if(inside(path.join(project,directory),resolved))reject('overlaps protected directory: '+directory);
  // Reject linked ancestors before creating anything, including a dangling link.
  // The caller supplies an output parent; its existing components must be real directories.
  const volume=path.parse(resolved).root;let current=volume;
  for(const component of path.relative(volume,resolved).split(path.sep).filter(Boolean)) {
    current=path.join(current,component);let stat;
    try{stat=fs.lstatSync(current);}catch(error){if(error.code==='ENOENT')continue;throw error;}
    if(stat.isSymbolicLink())reject('contains a linked component');
    if(!stat.isDirectory())reject('contains a non-directory component');
  }
  return resolved;
}
