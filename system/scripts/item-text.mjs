import {escape} from './rolls.mjs';

// Legacy descriptions were plain text; preserve their line breaks and literal < >.
export function itemEditorText(value='') {
  const text=String(value??'');
  return /<\/?[a-z][\w:-]*(?:\s[^>]*|\s*\/?)>/i.test(text)
    ? text : escape(text).replace(/\r?\n/g,'<br>');
}

export async function itemTextHTML(value,relativeTo,{secrets=false}={}) {
  return foundry.applications.ux.TextEditor.enrichHTML(itemEditorText(value),{relativeTo,secrets});
}
