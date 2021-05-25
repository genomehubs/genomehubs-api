import { attrTypes } from "../functions/attrTypes";

export const histogramAgg = async ({ field, result, rawValues, bounds }) => {
  const scales = {
    log2: "Math.log(_value)/Math.log(2)",
    log10: "Math.log10(_value)",
    sqrt: "Math.sqrt(_value)",
  };
  const funcs = {
    log2: (value) => Math.log(value) / Math.log(2),
    log10: (value) => Math.log10(value),
    sqrt: (value) => Math.sqrt(value),
    linear: (value) => value,
  };

  let typesMap = await attrTypes({ result });
  if (!typesMap[field]) {
    return;
  }
  let { scale, min, max, count } = typesMap[field].bins;
  let interval;
  if (bounds) {
    min = funcs[scale](bounds.domain[0]);
    max = funcs[scale](bounds.domain[1]);
    count = bounds.tickCount - 1;
  }
  if (count) {
    interval = (max - min) / count;
  }
  return {
    histogram: {
      field: `attributes${rawValues ? ".values" : ""}.${
        typesMap[field].type
      }_value`,
      ...(scales[scale] && { script: scales[scale] }),
      ...(interval && { interval }),
      extended_bounds: {
        min,
        max,
      },
      offset: min,
    },
  };
};
