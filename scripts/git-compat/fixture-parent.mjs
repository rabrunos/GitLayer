import fs from 'node:fs';
import path from 'node:path';

const inside=(root,target)=>{const rel=path.relative(root,target);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};
export function validateFixtureParent(candidate,{projectRoot}={}) {
  const reject=reason=>{throw Object.assign(Error('Existing fixture parent '+reason),{code:'EXISTING_FIXTURE_PARENT_INVALID'});};
  if(typeof candidate!=='string'||!candidate.trim()||typeof projectRoot!=='string'||!path.isAbsolute(projectRoot))reject('requires an existing directory and an absolute projectRoot');
  const resolved=path.resolve(candidate),volume=path.parse(resolved).root;let current=volume;
  for(const component of path.relative(volume,resolved).split(path.sep).filter(Boolean)) {
    current=path.join(current,component);let stat;
    try{stat=fs.lstatSync(current);}catch{reject('must exist and be readable before setup');}
    if(stat.isSymbolicLink())reject('cannot contain a linked component');
    if(!stat.isDirectory())reject('must contain only real directories');
  }
  const real=fs.realpathSync(resolved),checkout=fs.realpathSync(projectRoot);
  if(inside(checkout,real))reject('must be outside the development checkout');
  for(let ancestor=real;;ancestor=path.dirname(ancestor)) {
    let marker;
    try{marker=fs.lstatSync(path.join(ancestor,'.git'));}catch(error){if(error.code!=='ENOENT')reject('ancestry must be readable before setup');}
    if(marker)reject('cannot be inside a Git worktree (.git ancestor detected)');
    if(path.dirname(ancestor)===ancestor)break;
  }
  return real;
}
