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
  return Object.keys(properties).length == 0
    ? []
    : Object.keys(properties).map((field) => rangeQuery(field));
};
