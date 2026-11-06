import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export type Status = 'RUNNING' | 'WAITING_APPROVAL' | 'COMPLETED' | 'FAILED';
export type Event = { seq: number; kind: 'START'|'REQUEST_APPROVAL'|'APPROVED'|'REJECTED'|'DONE'; at: string; data?: string };
export type Snapshot = { runId: string; version: number; status: Status; cursor: number; pending?: {tool: string; args: string; approvalId: string}; events: Event[] };
export class Conflict extends Error {}
export class InvalidTransition extends Error {}
export interface Store { load(id:string):Promise<Snapshot|undefined>; cas(id:string,expected:number,next:Snapshot):Promise<void> }
const clone = <T>(v:T):T => structuredClone(v);
export class MemoryStore implements Store {
  private data=new Map<string,Snapshot>();
  async load(id:string){ const s=this.data.get(id); return s&&clone(s) }
  async cas(id:string,expected:number,next:Snapshot){ const current=this.data.get(id); if((current?.version??0)!==expected)throw new Conflict('stale version'); if(next.version!==expected+1)throw new Error('version must increment'); this.data.set(id,clone(next)) }
}
// Single-process demonstration ONLY. Atomic rename prevents torn files, but does not provide cross-process CAS.
export class FileStore implements Store {
  private lock=Promise.resolve();
  private readonly root:string;
  constructor(root:string){this.root=root}
  private path(id:string){ if(!/^[a-zA-Z0-9_-]+$/.test(id))throw new Error('invalid runId');return `${this.root}/${id}.json` }
  async load(id:string){try{return JSON.parse(await readFile(this.path(id),'utf8')) as Snapshot}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw e}}
  async cas(id:string,expected:number,next:Snapshot){
    const previous=this.lock;let unlock!:()=>void;this.lock=new Promise<void>(r=>unlock=r);await previous;
    try{const s=await this.load(id);if((s?.version??0)!==expected)throw new Conflict('stale version');if(next.version!==expected+1)throw new Error('invalid version');const path=this.path(id);await mkdir(dirname(path),{recursive:true});const tmp=`${path}.${process.pid}.${crypto.randomUUID()}.tmp`;await writeFile(tmp,JSON.stringify(next),'utf8');await rename(tmp,path)}finally{unlock()}
  }
}
const event=(s:Snapshot,kind:Event['kind'],data?:string):Event=>({seq:s.events.length+1,kind,at:new Date().toISOString(),...(data?{data}:{})});
export class Runtime {
  private readonly store:Store;
  constructor(store:Store){this.store=store}
  async start(id:string){const s:Snapshot={runId:id,version:1,status:'RUNNING',cursor:0,events:[{seq:1,kind:'START',at:new Date().toISOString()}]};await this.store.cas(id,0,s);return s}
  async requestApproval(id:string,tool:string,args:string){const s=await this.required(id);if(s.status!=='RUNNING')throw new InvalidTransition('not running');const approvalId=`${id}:${s.cursor+1}`;const n:Snapshot={...s,version:s.version+1,status:'WAITING_APPROVAL',pending:{tool,args,approvalId},events:[...s.events,event(s,'REQUEST_APPROVAL',approvalId)]};await this.store.cas(id,s.version,n);return n}
  async decide(id:string,approvalId:string,approved:boolean){const s=await this.required(id);if(s.status!=='WAITING_APPROVAL'||s.pending?.approvalId!==approvalId)throw new InvalidTransition('not pending approval');const n:Snapshot={...s,version:s.version+1,status:approved?'RUNNING':'FAILED',cursor:s.cursor+(approved?1:0),pending:undefined,events:[...s.events,event(s,approved?'APPROVED':'REJECTED',approvalId)]};await this.store.cas(id,s.version,n);return n}
  async finish(id:string){const s=await this.required(id);if(s.status!=='RUNNING'||s.pending)throw new InvalidTransition('not runnable');const n:Snapshot={...s,version:s.version+1,status:'COMPLETED',events:[...s.events,event(s,'DONE')]};await this.store.cas(id,s.version,n);return n}
  async recover(id:string){return this.required(id)} // recovery reads snapshot; does NOT replay external effects
  private async required(id:string){const s=await this.store.load(id);if(!s)throw new Error('run missing');return s}
}