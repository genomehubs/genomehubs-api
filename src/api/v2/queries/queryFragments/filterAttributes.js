export const filterAttributes = (
  filters,
  typesMap,
  aggregation_source,
  searchRawValues
) => {
  if (Object.keys(filters).length == 0) {
    return [];
  }
  let rangeQuery;
  if (searchRawValues) {
    rangeQuery = (field) => {
      // TODO: support enum based query here
      return {
        nested: {
          path: "attributes.values",
          query: {
            range: {
              [`attributes.values.${typesMap[field].type}_value`]:
                filters[field],
            },
          },
        },
      };
    };
  } else {
    rangeQuery = (field) => {
      let stat = `${typesMap[field].type}_value`;
      let filter = { ...filters[field] };
      if (filter.stat) {
        stat = filter.stat;
        delete filter.stat;
      }
      let meta = typesMap[field];
      if (
        meta.type == "keyword" &&
        meta.summary &&
        meta.summary.includes("enum")
      ) {
        let list = meta.constraint.enum;
        const operator = Object.keys(filter)[0];
        const value = Object.values(filter)[0];
        if (Object.keys(filter).length == 1) {
          let terms = [];
          let found = false;
          for (const term of list) {
            if (operator.startsWith("gt") && !found) {
              if (term == value) {
                if (operator.endsWith("e")) {
                  terms.push(term);
                }
                break;
              }
              terms.push(term);
              continue;
            }
            if (term == value) {
              found = true;
              if (operator.endsWith("e")) {
                terms.push(term);
              }
              continue;
            }
            if (found) {
              terms.push(term);
            }
          }
          return {
            bool: {
              should: terms.map((term) => {
                return {
                  match: { [`attributes.${stat}`]: term },
                };
              }),
            },
          };
        } else {
          return {
            match: { [`attributes.${stat}`]: value },
          };
        }
      }
      return {
        range: {
          [`attributes.${stat}`]: filter,
        },
      };
    };
  }

  return Object.keys(filters).length == 0
    ? []
    : Object.keys(filters).map((field) => ({
        nested: {
          path: "attributes",
          query: {
            bool: {
              filter: [
                { match: { "attributes.key": field } },
                rangeQuery(field),
              ].concat(aggregation_source),
            },
          },
        },
      }));
};
