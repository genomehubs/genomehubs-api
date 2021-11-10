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
      if (!Array.isArray(filters[field])) {
        filters[field] = [filters[field]];
      }
      return filters[field].map((flt) => {
        if (typeof flt !== "object") {
          let values = flt.split(",");
          return {
            bool: {
              should: values.map((value) => ({
                match: { [`attributes.${stat}`]: value },
              })),
            },
          };
          // return {
          //   bool: {
          //     should: values.map((value) => ({
          //       bool: {
          //         filter: [{ match: { [`attributes.${stat}`]: value } }].concat(
          //           aggregation_source
          //         ),
          //       },
          //     })),
          //   },
          // };
          // return { match: { [`attributes.${stat}`]: flt } };
        }
        return {
          range: {
            [`attributes.${stat}`]: flt,
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
