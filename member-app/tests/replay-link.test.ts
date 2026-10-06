import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replayRoute,replayLoginRedirect} from '../src/replay-link.ts';
test('a private replay survives email sign-in without allowing an external redirect',()=>{
  const id='6af203c7-60c7-4c0d-9ffa-b1d823738566';
  assert.equal(replayRoute('?replay='+id),'/replay/'+id);
  assert.equal(replayLoginRedirect('?replay='+id),'/app/?replay='+id);
  for(const value of ['https://evil.example','../../studio','bad','']){
    assert.equal(replayRoute('?replay='+encodeURIComponent(value)),null);
    assert.equal(replayLoginRedirect('?replay='+encodeURIComponent(value)),'/app/');
  }
});
