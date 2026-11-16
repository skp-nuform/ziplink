import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configured,passwordMatches,makeSession,validSession,sessionSeconds } from '../lib/authorization.ts';
const secret='test-only-password-at-least-24-characters';
test('authentication fails closed without a strong configured password',()=>{assert.equal(configured(''),false);assert.equal(configured('short'),false);assert.equal(passwordMatches('',''),false);assert.equal(validSession('',''),false);});
test('only the correct password is accepted',()=>{assert.equal(passwordMatches(secret,secret),true);assert.equal(passwordMatches('wrong',secret),false);});
test('signed session validates and tampering fails',()=>{const token=makeSession(secret);assert.equal(validSession(token,secret),true);assert.equal(validSession(token.slice(0,-1)+(token.endsWith('a')?'b':'a'),secret),false);assert.equal(validSession(token,secret+'changed'),false);assert.equal(validSession('forged',secret),false);});
test('sessions expire and future tokens are rejected',()=>{const now=Date.now();const token=makeSession(secret,now);assert.equal(validSession(token,secret,now+sessionSeconds*1000),false);assert.equal(validSession(makeSession(secret,now+10000),secret,now),false);});
