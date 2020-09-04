import { processDoc } from "./processDoc";

export const processHits = ({ body, reason, inner_hits, processAsDoc }) => {
  let results = [];
  body.hits.hits.forEach((hit) => {
    let result = {
      index: hit._index,
      id: hit._id,
      score: hit._score,
      result: hit._source,
    };
    if (processAsDoc) {
      result.result = processDoc({ doc: hit._source });
    } else {
      result.result = hit._source;
    }
    if (reason && hit.inner_hits) {
      let reason = [];
      Object.keys(hit.inner_hits).forEach((key) => {
        hit.inner_hits[key].hits.hits.forEach((inner_hit) => {
          reason.push({ score: inner_hit._score, fields: inner_hit.fields });
        });
      });
      if (reason.length > 0) {
        result.reason = reason;
      }
    }
    if (inner_hits && hit.inner_hits) {
      let fields = {};
      Object.keys(hit.inner_hits).forEach((key) => {
        hit.inner_hits[key].hits.hits.forEach((inner_hit) => {
          let name;
          let field = {};
          Object.keys(inner_hit.fields).forEach((ikey) => {
            if (ikey.match(/\.key$/)) {
              name = inner_hit.fields[ikey][0];
            } else if (ikey.match(/_value$/)) {
              if (inner_hit.fields[ikey].length == 1) {
                field.value = inner_hit.fields[ikey][0];
              } else {
                field.value = inner_hit.fields[ikey];
              }
            } else {
              if (inner_hit.fields[ikey].length == 1) {
                field[ikey.replace(/attribute\./, "")] =
                  inner_hit.fields[ikey][0];
              } else {
                field[ikey.replace(/attribute\./, "")] = inner_hit.fields[ikey];
              }
            }
          });
          if (name) {
            fields[name] = field;
          }
        });
      });
      if (Object.keys(fields).length > 0) {
        result.fields = fields;
      }
    }
    results.push(result);
  });
  return results;
};
