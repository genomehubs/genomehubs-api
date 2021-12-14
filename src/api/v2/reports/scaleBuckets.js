import { fmt } from "./fmt";
import { scales } from "./scales";

export const scaleBuckets = (buckets, scaleType = "Linear", bounds) => {
  if (scaleType == "date") {
    // let interval = buckets[1] - buckets[0];
    buckets = buckets.map((value) => value);
  } else if (scaleType == "log2") {
    let domain = 2 ** buckets[buckets.length - 1] - 2 ** buckets[0];
    let factor = (bounds.domain[1] - bounds.domain[0]) / domain;
    let scale = (v) => 2 ** v * factor;
    buckets = buckets.map((value) => 1 * fmt(scale(value)));
  } else {
    let scale = scales[scaleType]()
      .domain(bounds.domain)
      .range([buckets[0], buckets[buckets.length - 1]]);
    buckets = buckets.map((value) => 1 * fmt(scale.invert(value)));
  }
  return buckets;
};
