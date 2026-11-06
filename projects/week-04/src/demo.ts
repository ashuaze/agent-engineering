import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Runtime, FileStore } from './runtime.ts';
const dir=await mkdtemp(join(tmpdir(),'agent-week04-'));
const first=new Runtime(new FileStore(dir));await first.start('demo');const paused=await first.requestApproval('demo','sendEmail','{"to":"example"}');
const afterRestart=new Runtime(new FileStore(dir));const recovered=await afterRestart.recover('demo');console.log('recovered:',recovered.status,recovered.version);
await afterRestart.decide('demo',paused.pending!.approvalId,true);const done=await afterRestart.finish('demo');console.log('done:',done.status,done.events.map(e=>e.kind).join(' -> '));