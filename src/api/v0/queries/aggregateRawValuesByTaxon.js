import { typesMap } from "../functions/typesMap";

const scales = {
  log10: "Math.log10(_value)",
  sqrt: "Math.sqrt(_value)",
};

export const aggregateRawValuesByTaxon = ({
  lineage,
  fields,
  scale = "log10",
  interval = 0.5,
}) => {
  return {
    size: 0,
    query: {
      bool: {
        should: [
          {
            match: { taxon_id: lineage },
          },
          {
            nested: {
              path: "lineage",
              query: {
                match: { "lineage.taxon_id": lineage },
              },
            },
          },
        ],
      },
    },
    aggs: {
      attributes: {
        nested: {
          path: "attributes",
        },
        aggs: {
          [fields[0]]: {
            filter: {
              bool: {
                filter: [
                  {
                    term: { "attributes.key": fields[0] },
                  },
                  {
                    term: { "attributes.aggregation_source": "direct" },
                  },
                ],
              },
            },
            aggs: {
              summary: {
                nested: {
                  path: "attributes.values",
                },
                aggs: {
                  histogram: {
                    histogram: {
                      field: `attributes.values.${
                        typesMap[fields[0]].type
                      }_value`,
                      ...(scales[scale] && { script: scales[scale] }),
                      ...(interval && { interval }),
                      extended_bounds: {
                        min: 6,
                        max: 11,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
};
