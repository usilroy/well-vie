import type {AudioObject,AudioInventory} from './types.ts';
export function classifyAudio(objects:AudioObject[],references:Set<unknown>,now=new Date()):AudioInventory{
  const result:AudioInventory={scanned:0,referenced:0,candidates:[],recent:[],unknown:[],scannedAt:now.toISOString()};
  const unique=new Map(objects.map(file=>[file.path,file]));result.scanned=unique.size;
  for(const file of unique.values()){
    if(references.has(file.path)){result.referenced++;continue;}
    const age=file.createdAt?Date.parse(file.createdAt):NaN;
    if(!Number.isFinite(age))result.unknown.push(file);
    else if(age<=+now-7*86400000)result.candidates.push(file);else result.recent.push(file);
  }
  return result;
}
