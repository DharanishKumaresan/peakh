import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import * as records from '../app/records.ts';

const exports = {};
const source = readFileSync(new URL('../app/activity-detail.tsx', import.meta.url), 'utf8');
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  exports,
  require: name => {
    if (name === 'react/jsx-runtime') return jsx;
    if (name === 'react') return { useState: () => ['All', () => {}], useId: () => 'test-chart' };
    if (name === './records') return records;
    if (name === 'recharts') return Object.fromEntries(['ResponsiveContainer', 'AreaChart', 'Area', 'ReferenceLine', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip'].map(n => [n, n]));
    throw Error(name);
  },
});
function flatten(node) {
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (!node || typeof node !== 'object') return [];
  return [node, ...flatten(node.props?.children)];
}
test('better performance goes up and plotted values remain unchanged', () => {
  for (const activity of records.makeSeed().activities) {
    const nodes = flatten(exports.default({ activity }));
    assert.equal(nodes.find(n => n.type === 'YAxis').props.reversed, activity.lower);
    const points = nodes.find(n => n.type === 'AreaChart').props.data;
    assert.deepEqual(Array.from(points, p => p.value), activity.entries.map(e => e.value));
  }
});
test('only editable histories offer deletion and pass the exact entry ID', () => {
  const activity = records.makeSeed().activities[0];
  let selected;
  const onDelete = id => { selected = id; };
  const nodes = flatten(exports.default({ activity, editable: true, onDelete }));
  const buttons = nodes.filter(n => n.type === 'button' && n.props.className === 'delete-record mono');
  assert.equal(buttons.length, activity.entries.length);
  buttons[0].props.onClick();
  assert.equal(selected, activity.entries.at(-1).id);
  const friendNodes = flatten(exports.default({ activity, onDelete }));
  assert.equal(friendNodes.filter(n => n.props?.className === 'delete-record mono').length, 0);
});
