export const typesMap = {
  assembly_span: { type: "long", fields: ["count", "max", "min"] },
  genome_size: { type: "long", fields: ["count", "max", "min"] },
  sample_location: { type: "geo_point", fields: ["count"] },
  sample_sex: { type: "keyword", fields: ["count"] },
};
