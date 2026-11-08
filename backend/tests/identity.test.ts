import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { autoMatchTitle, playerCodePrefix } from '../src/services/identity.service.js';

describe('playerCodePrefix', () => {
  it('takes the first three alphanumerics of the subdomain', () => {
    assert.equal(playerCodePrefix('apex-ff'), 'APE');
    assert.equal(playerCodePrefix('deadesports'), 'DEA');
    assert.equal(playerCodePrefix('thunder'), 'THU');
  });

  it('falls back to the brand name when the subdomain is missing', () => {
    assert.equal(playerCodePrefix(null, 'Thunder eSports'), 'THU');
    assert.equal(playerCodePrefix(undefined, 'Apex'), 'APE');
  });

  it('always returns exactly three uppercase characters', () => {
    assert.equal(playerCodePrefix(null, null), 'PLY');
    assert.equal(playerCodePrefix('', ''), 'PLY');
    assert.equal(playerCodePrefix('a'), 'AXX');
    assert.equal(playerCodePrefix('---'), 'PLY');
    assert.equal(playerCodePrefix('a-b-c-d'), 'ABC');
  });
});

describe('autoMatchTitle', () => {
  it('builds a readable title from known map and type labels', () => {
    assert.equal(autoMatchTitle('BERMUDA', 'SOLO', 12), '12 | Bermuda Solo');
    assert.equal(autoMatchTitle('PURGATORY', 'SQUAD', 3), '3 | Purgatory Squad');
  });

  it('keeps unknown values verbatim instead of dropping them', () => {
    assert.equal(autoMatchTitle('KALAHARI', 'DUO', 5), '5 | Kalahari Duo');
    assert.equal(autoMatchTitle('ARENA', 'SOLO', 1), '1 | ARENA Solo');
    assert.equal(autoMatchTitle('BERMUDA', 'TDM', 2), '2 | Bermuda TDM');
  });
});
