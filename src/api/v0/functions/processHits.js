import { processDoc } from "./processDoc";

export const processHits = ({
  body,
  names,
  ranks,
  reason,
  inner_hits,
  processAsDoc,
}) => {
  let results = [];
  body.hits.hits.forEach((hit) => {
    let result = {
      index: hit._index,
      id: hit._id,
      score: hit._score,
      result: hit._source,
    };
    if (processAsDoc) {
      result.result = processDoc({
        doc: hit._source,
        inner_hits: hit.inner_hits,
      });
    } else {
      result.result = hit._source;
      // if (names) {
      //   console.log(names);
      //   console.log(hit);
      // }
      if (hit.inner_hits && hit.inner_hits.taxon_names) {
        if (names) {
          let taxonNames = {};
          hit.inner_hits.taxon_names.hits.hits.forEach((obj) => {
            let hitNames = {};
            Object.keys(obj.fields).forEach((key) => {
              hitNames[key.replace("taxon_names.", "").replace(".raw", "")] =
                obj.fields[key];
            });
            taxonNames[obj.fields["taxon_names.class"]] = hitNames;
          });
          result.result.names = taxonNames;
          // delete result.result.taxon_names;
        }
      }
      if (hit.inner_hits && hit.inner_hits.lineage) {
        if (ranks) {
          let taxonRanks = {};
          hit.inner_hits.lineage.hits.hits.forEach((obj) => {
            let hitRanks = {};
            Object.keys(obj.fields).forEach((key) => {
              let value = obj.fields[key];
              if (Array.isArray(value) && value.length == 1) {
                value = value[0];
              }
              hitRanks[key.replace("lineage.", "").replace(".raw", "")] = value;
            });
            taxonRanks[obj.fields["lineage.taxon_rank"]] = hitRanks;
          });
          result.result.ranks = taxonRanks;
        }
      }
      if (result.result.lineage) {
        if (ranks) {
          let taxonRanks = { ...ranks };
          result.result.lineage.forEach((anc) => {
            if (taxonRanks[anc.taxon_rank]) {
              taxonRanks[anc.taxon_rank] = anc;
            }
          });
          if (taxonRanks[result.result.taxon_rank]) {
            taxonRanks[result.result.taxon_rank] = {
              scientific_name: result.result.scientific_name,
              taxon_id: result.result.taxon_id,
              taxon_rank: result.result.taxon_rank,
            };
          }
          result.result.ranks = taxonRanks;
          delete result.result.lineage;
        }
      }
      if (result.result.attributes) {
        let fields = {};
        result.result.attributes.forEach((attribute) => {
          let name;
          let field = {};

          Object.keys(attribute).forEach((key) => {
            if (key == "key") {
              name = attribute[key];
            } else if (key.match(/_value$/)) {
              if (key == "is_primary_value") {
                field.is_primary = true;
              } else {
                field.value = attribute[key];
              }
            } else if (key == "values") {
              field.rawValues = attribute[key].map((value) => {
                let retValue = {};
                Object.keys(value).forEach((vkey) => {
                  if (vkey.match(/_value$/)) {
                    if (vkey == "is_primary_value") {
                      retValue.is_primary = true;
                    } else {
                      retValue.value = value[vkey];
                    }
                  } else {
                    retValue[vkey] = value[vkey];
                  }
                });
                return retValue;
              });
            } else {
              field[key] = attribute[key];
            }
          });

          if (name) {
            fields[name] = field;
          }
        });
        if (Object.keys(fields).length > 0) {
          result.result.fields = fields;
        }
        delete result.result.attributes;
      }
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
          if (inner_hit.fields) {
            Object.keys(inner_hit.fields).forEach((ikey) => {
              if (ikey.match(/\.key$/)) {
                name = inner_hit.fields[ikey][0];
              } else if (ikey.match(/_value$/) || ikey.match(/_value.raw$/)) {
                if (inner_hit.fields[ikey].length == 1) {
                  field.value = inner_hit.fields[ikey][0];
                } else {
                  field.value = inner_hit.fields[ikey];
                }
              } else {
                if (inner_hit.fields[ikey].length == 1) {
                  field[ikey.replace(/attributes\./, "")] =
                    inner_hit.fields[ikey][0];
                } else {
                  field[ikey.replace(/attributes\./, "")] =
                    inner_hit.fields[ikey];
                }
              }
            });
          }
          if (name) {
            // if (
            //   name.endsWith("_date") &&
            //   field.value.endsWith("T00:00:00.000Z")
            // ) {
            //   field.value = field.value.replace("T00:00:00.000Z", "");
            // }
            fields[name] = field;
          }
        });
      });
      if (Object.keys(fields).length > 0) {
        result.result.fields = fields;
      }
    }
    results.push(result);
  });
  return results;
};
