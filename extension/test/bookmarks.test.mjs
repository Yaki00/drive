import assert from 'node:assert/strict';
import {
  dedupeByUrl,
  flattenBookmarkTree,
  isImportableUrl,
  normalizeUrl,
  toLinkPayload,
} from '../lib/bookmarks.js';

const sampleTree = [
  {
    id: '0',
    title: 'Bookmarks bar',
    children: [
      { id: '1', title: 'GitHub', url: 'https://github.com' },
      { id: '2', title: 'Relative', url: 'example.com' },
      { id: '3', title: 'Bad', url: 'javascript:void(0)' },
      {
        id: '4',
        title: 'Dev',
        children: [
          { id: '5', title: 'Nest', url: 'https://nestjs.com' },
          { id: '6', title: 'Dup', url: 'https://github.com' },
        ],
      },
    ],
  },
];

const flat = flattenBookmarkTree(sampleTree);
assert.equal(flat.length, 4, 'keeps only http(s) bookmarks');
assert.equal(flat[0].title, 'GitHub');
assert.equal(normalizeUrl('example.com'), 'https://example.com');
assert.equal(isImportableUrl('ftp://files.example.com'), false);

const deduped = dedupeByUrl(flat);
assert.equal(deduped.length, 3, 'dedupes identical URLs');

const payload = toLinkPayload(flat[0]);
assert.equal(payload.createdBy, 'extension');
assert.equal(payload.title, 'GitHub');

console.log('bookmarks.test.mjs: all tests passed');
