import fs from 'node:fs';

// A read-only ZIP header observer, independent of .NET's path interpretation.
// It never extracts or rewrites a name. ZIP64 is needed by the real evidence
// package once the central directory contains more than 65,535 records.
export function inspectZipNames(file) {
  const bytes=fs.readFileSync(file);let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50&&i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}
  if(end<0)throw Error('ZIP end-of-central-directory missing');
  if(bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6))throw Error('Split ZIP not supported by observer');
  let count=bytes.readUInt16LE(end+10),size=bytes.readUInt32LE(end+12),offset=bytes.readUInt32LE(end+16),zip64=false;
  const number=value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<0||n>bytes.length)throw Error('ZIP observer offset outside file');return n;};
  if(count===0xffff||size===0xffffffff||offset===0xffffffff){
    const locator=end-20;if(locator<0||bytes.readUInt32LE(locator)!==0x07064b50)throw Error('ZIP64 locator missing');
    const at=number(bytes.readBigUInt64LE(locator+8));if(bytes.readUInt32LE(at)!==0x06064b50)throw Error('ZIP64 end record missing');
    const total=bytes.readBigUInt64LE(at+32);if(total>1000000n)throw Error('ZIP observer record bound exceeded');
    count=Number(total);size=number(bytes.readBigUInt64LE(at+40));offset=number(bytes.readBigUInt64LE(at+48));zip64=true;
  }
  const entries=[];let at=offset;
  for(let i=0;i<count;i++){
    if(at+46>bytes.length||bytes.readUInt32LE(at)!==0x02014b50)throw Error('ZIP central-directory record missing');
    const flags=bytes.readUInt16LE(at+8),nameLength=bytes.readUInt16LE(at+28),extraLength=bytes.readUInt16LE(at+30),commentLength=bytes.readUInt16LE(at+32),name=bytes.subarray(at+46,at+46+nameLength);
    let localOffset=bytes.readUInt32LE(at+42);
    if(localOffset===0xffffffff){
      const extra=bytes.subarray(at+46+nameLength,at+46+nameLength+extraLength);let found=false;
      for(let p=0;p+4<=extra.length;p+=4+extra.readUInt16LE(p+2))if(extra.readUInt16LE(p)===1){let field=p+4;if(bytes.readUInt32LE(at+24)===0xffffffff)field+=8;if(bytes.readUInt32LE(at+20)===0xffffffff)field+=8;localOffset=number(extra.readBigUInt64LE(field));found=true;break;}
      if(!found)throw Error('ZIP64 local-header offset missing');
    }
    if(localOffset+30>bytes.length||bytes.readUInt32LE(localOffset)!==0x04034b50)throw Error('ZIP local header missing');
    const localName=bytes.subarray(localOffset+30,localOffset+30+bytes.readUInt16LE(localOffset+26));
    if(!name.equals(localName))throw Error('ZIP local/central names disagree');
    const decoded=new TextDecoder('utf-8',{fatal:true}).decode(name);
    entries.push({name:decoded,name_hex:name.toString('hex'),local_name_hex:localName.toString('hex'),utf8:Boolean(flags&0x0800),contains_backslash:name.includes(0x5c),external_attributes:bytes.readUInt32LE(at+38),directory:decoded.endsWith('/')});
    at+=46+nameLength+extraLength+commentLength;
  }
  if(at!==offset+size)throw Error('ZIP central-directory length mismatch');
  return {zip64,entries};
}

function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}

// Deliberately malformed names/modes exercise the actual PowerShell validator.
// The tiny fixture encoder only uses stored data and has no extraction code.
export function storedZip(records){
  const locals=[],centrals=[];let offset=0;
  for(const r of records){
    const name=Buffer.from(r.name,'utf8'),data=Buffer.from(r.data??'synthetic zip canary\n'),crc=crc32(data);
    const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x0800,6);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
    const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE((3<<8)|20,4);central.writeUInt16LE(20,6);central.writeUInt16LE(0x0800,8);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);central.writeUInt32LE(r.external_attributes??0,38);central.writeUInt32LE(offset,42);
    locals.push(local,name,data);centrals.push(central,name);offset+=local.length+name.length+data.length;
  }
  const directory=Buffer.concat(centrals),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(records.length,8);end.writeUInt16LE(records.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...locals,directory,end]);
}
