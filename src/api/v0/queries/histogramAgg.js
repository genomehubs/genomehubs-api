import { attrTypes } from "../functions/attrTypes";
import { scaleTime } from "d3-scale";

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

  const duration = (interval) => {
    const day = 86400000;
    if (interval < day) {
      return "1h";
    } else if (interval < 21 * day) {
      return "1d";
    } else if (interval < 90 * day) {
      return "1w";
    } else if (interval < 366 * day) {
      return "1M";
    } else if (interval < 1000 * day) {
      return "1q";
    }
    return "1y";
  };

  const timeLimits = (startTime, endTime) => {
    let ticks = scaleTime().domain([startTime, endTime]).nice().ticks();
    return [ticks[0], ticks[ticks.length - 1]];
  };

  let typesMap = await attrTypes({ result });
  if (!typesMap[field]) {
    return;
  }

  let scale, min, max, count, offset;
  let interval, calendar_interval, histKey;

  if (typesMap[field].type == "date") {
    histKey = "date_histogram";
    [min, max] = timeLimits(bounds.stats.min, bounds.stats.max);
    min = Date.parse(bounds.domain[0]) || min;
    max = Date.parse(bounds.domain[1]) || max;
    calendar_interval = duration(Date.parse(max) - Date.parse(min));
  } else {
    histKey = "histogram";
    ({ scale, min, max, count } = typesMap[field].bins);
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
    offset = min;
  }
  return {
    [histKey]: {
      field: `attributes${rawValues ? ".values" : ""}.${
        typesMap[field].type
      }_value`,
      ...(scales[scale] && { script: scales[scale] }),
      ...(interval && { interval }),
      ...(calendar_interval && { calendar_interval }),
      extended_bounds: {
        min,
        max,
      },
      offset,
    },
    aggs: {
      yHistograms,
    },
  };
};
