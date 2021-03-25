import { Parser } from "json2csv";

export const formatCsv = async (response, opts) => {
  const fields = ["taxon_id", "taxon_rank", "scientific_name"];
  let names = [];
  if (opts.names) {
    opts.names.forEach((nameClass) => {
      names.push(nameClass);
    });
  }
  let ranks = [];
  if (opts.ranks) {
    opts.ranks.forEach((rank) => {
      ranks.push(rank);
    });
  }
  let meta = ["aggregation_source", "aggregation_method"];
  let raw = ["source"];
  let usedFields = {};
  let data = [];
  response.results.forEach((fullResult) => {
    let datum = {};
    fields.forEach((key) => {
      datum[key] = fullResult.result[key];
    });
    if (opts.names) {
      opts.names.forEach((nameClass) => {
        datum[nameClass] = fullResult.result.names[nameClass].name;
      });
    }
    if (opts.ranks) {
      opts.ranks.forEach((rank) => {
        datum[rank] = fullResult.result.ranks[rank].scientific_name;
      });
    }
    if (opts.fields) {
      opts.fields.forEach((key) => {
        if (fullResult.result.fields.hasOwnProperty(key)) {
          usedFields[key] = true;
          let value = fullResult.result.fields[key].value;
          if (opts.tidyData) {
            if (opts.includeRawValues) {
              if (fullResult.result.fields[key].hasOwnProperty("rawValues")) {
                fullResult.result.fields[key]["rawValues"].forEach(
                  (rawValue) => {
                    let row = { ...datum };
                    row.field = key;
                    row.value = rawValue.value;
                    raw.forEach((rawKey) => {
                      if (rawValue.hasOwnProperty(rawKey)) {
                        row[rawKey] = rawValue[rawKey];
                      }
                    });
                    data.push(row);
                  }
                );
              }
            } else {
              if (!Array.isArray(value)) {
                value = [value];
              }
              value.forEach((val) => {
                let row = { ...datum };
                row.field = key;
                row.value = val;
                meta.forEach((metaKey) => {
                  if (fullResult.result.fields[key].hasOwnProperty(metaKey)) {
                    row[metaKey] = fullResult.result.fields[key][metaKey];
                  }
                });
                data.push(row);
              });
            }
          } else {
            if (Array.isArray(value)) {
              value = value.join(";");
            }
            datum[key] = value;
          }
        }
      });
    }
    if (!opts.tidyData) {
      data.push(datum);
    }
  });
  if (opts.tidyData) {
    if (Object.keys(usedFields).length > 0) {
      if (opts.includeRawValues) {
        opts.fields = fields
          .concat(names)
          .concat(ranks)
          .concat(["field", "value"])
          .concat(raw);
      } else {
        opts.fields = fields
          .concat(names)
          .concat(ranks)
          .concat(["field", "value"])
          .concat(meta);
      }
    }
  } else {
    opts.fields = fields
      .concat(names)
      .concat(ranks)
      .concat(Object.keys(usedFields));
  }

  try {
    const parser = new Parser(opts);
    const csv = parser.parse(data);
    return csv;
  } catch (err) {
    console.error(err);
  }

  return csv;
};
