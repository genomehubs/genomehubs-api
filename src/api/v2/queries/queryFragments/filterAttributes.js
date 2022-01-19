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
      return [
        {
          nested: {
            path: "attributes.values",
            query: {
              range: {
                [`attributes.values.${typesMap[field].type}_value`]:
                  filters[field],
              },
            },
          },
        },
      ];
    };
  } else {
    rangeQuery = (field) => {
      if (!typesMap[field]) {
        return [
          {
            match: { "attributes.key": field },
          },
        ];
      }
      let stat = `${typesMap[field].type}_value`;
      if (
        Array.isArray(filters[field]) &&
        typeof filters[field][0] === "string"
      ) {
        return [
          {
            bool: {
              filter: filters[field].map((term) => {
                let include = [];
                let exclude = [];
                for (let option of term.split(",")) {
                  if (option.startsWith("!")) {
                    option = option.replace("!", "");
                    exclude.push({
                      match: { [`attributes.${stat}`]: option },
                    });
                  } else {
                    include.push({
                      match: { [`attributes.${stat}`]: option },
                    });
                  }
                }

                return {
                  bool: {
                    should: include,
                    must_not: exclude,
                  },
                };
              }),
            },
          },
        ];
      }
      let filter = { ...filters[field] };
      if (filter.stat) {
        stat = filter.stat;
        delete filter.stat;
      }
      let meta = typesMap[field];
      if (
        meta.type == "keyword" &&
        meta.summary &&
        meta.summary.includes("enum") &&
        typeof Object.values(filter)[0] === "object"
      ) {
        let list = meta.constraint.enum;
        filter = filter[0];
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
          return [
            {
              bool: {
                should: terms.map((term) => {
                  return {
                    match: { [`attributes.${stat}`]: term },
                  };
                }),
              },
            },
          ];
        } else {
          return [
            {
              match: { [`attributes.${stat}`]: value },
            },
          ];
        }
      }
      if (!Array.isArray(filter)) {
        filter = [filter];
      }
      return filter.map((flt) => {
        if (typeof flt !== "object") {
          let values = flt.split(",");
          return {
            bool: {
              should: values.map((value) => ({
                match: { [`attributes.${stat}`]: value },
              })),
            },
          };
        }
        let boolOperator = "should";
        if (flt.hasOwnProperty("ne")) {
          boolOperator = "must_not";
          delete flt.ne;
        }
        return {
          bool: {
            [boolOperator]: {
              range: {
                [`attributes.${stat}`]: flt,
              },
            },
          },
        };
      });
    };
  }
  return Object.keys(filters).length == 0
    ? []
    : Object.keys(filters).map((field) => ({
        nested: {
          path: "attributes",
          query: {
            bool: {
              filter: [{ match: { "attributes.key": field } }]
                .concat(aggregation_source)
                .concat(rangeQuery(field)),
            },
          },
        },
      }));
};
