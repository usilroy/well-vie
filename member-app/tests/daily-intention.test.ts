import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isTodaysIntention,nextLocalMidnight} from '../src/daily-intention.ts';

test('a new local day resets the prompt, even less than 24 hours after saving',()=>{
  const saved=new Date(2026,9,6,23,59);
  const midnight=nextLocalMidnight(saved);
  assert.equal(isTodaysIntention(saved.toISOString(),new Date(midnight.getTime()-1)),true);
  assert.equal(isTodaysIntention(saved.toISOString(),midnight),false);
  assert.equal(isTodaysIntention(new Date(2026,9,7,0,1).toISOString(),new Date(2026,9,7,19)),true);
  assert.equal(isTodaysIntention('invalid',midnight),false);
  assert.equal(isTodaysIntention(new Date(2027,9,6).toISOString(),saved),false);
});

test('midnight follows the local time zone and daylight-saving calendar',()=>{
  const previous=process.env.TZ;
  try {
    process.env.TZ='Europe/Paris';
    const spring=new Date('2026-03-28T23:00:00Z');
    const autumn=new Date('2026-10-24T22:00:00Z');
    assert.equal(nextLocalMidnight(spring).getTime()-spring.getTime(),23*3600000);
    assert.equal(nextLocalMidnight(autumn).getTime()-autumn.getTime(),25*3600000);
    const saved='2026-10-06T17:00:00Z',now=new Date('2026-10-06T19:00:00Z');
    assert.equal(isTodaysIntention(saved,now),true);
    process.env.TZ='Asia/Kolkata';
    assert.equal(isTodaysIntention(saved,now),false);
  } finally { if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous; }
});
