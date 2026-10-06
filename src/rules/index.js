import noAssertTests from './no-assert-tests.js';
import placeholderCode from './placeholder-code.js';
import slopComments from './slop-comments.js';
import commentRatio from './comment-ratio.js';
import copyPaste from './copy-paste.js';
import brokenImports from './broken-imports.js';
import todoSprawl from './todo-sprawl.js';
import hallucinatedApi from './hallucinated-api.js';

export const RULES = [
  noAssertTests,
  placeholderCode,
  slopComments,
  commentRatio,
  copyPaste,
  brokenImports,
  todoSprawl,
  hallucinatedApi,
];

export function activeRules(config, onlyIds) {
  return RULES.filter((r) => {
    if (onlyIds && !onlyIds.includes(r.id)) return false;
    const c = config.rules[r.id];
    if (c && c.enabled === false) return false;
    return true;
  });
}
