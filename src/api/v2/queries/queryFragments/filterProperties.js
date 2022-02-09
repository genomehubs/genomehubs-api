export const filterProperties = (properties) => {
  if (Object.keys(properties).length == 0) {
    return [];
  }
  let rangeQuery = (field) => {
    if (typeof properties[field] === "object") {
      return {
        range: {
          [field]: properties[field],
        },
      };
    } else {
      return {
        match: {
          [field]: properties[field],
        },
      };
    }
  };
  if (Object.keys(filters).length == 0) {
    return [];
  }
  let arr = [];
  Object.keys(filters).forEach((stat) => {
    let subset = Object.keys(filters[stat]).map((field) => rangeQuery(field));
    arr.push(...subset);
  });
  return arr;
};
