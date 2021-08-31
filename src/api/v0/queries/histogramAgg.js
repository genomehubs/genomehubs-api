import { attrTypes } from "../functions/attrTypes";

export const histogramAgg = async ({
  field,
  result,
  rawValues,
  bounds,
  yHistograms,
}) => {
  const scales = {
    log2: "Math.max(Math.log(_value)/Math.log(2), 0)",
    log10: "Math.log10(_value)",
    sqrt: "Math.sqrt(_value)",
  };
  const funcs = {
    log2: (value) => Math.log2(value),
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
    if (!isNaN(bounds.domain[0])) {
      min = funcs[scale](bounds.domain[0]);
    }
    if (!isNaN(bounds.domain[1])) {
      max = funcs[scale](1 * bounds.domain[1]);
    }
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
    aggs: {
      yHistograms,
    },
  };
};
