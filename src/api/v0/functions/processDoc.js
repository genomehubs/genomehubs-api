export const processDoc = ({ doc }) => {
  let attributes = {};
  if (doc.attributes) {
    doc.attributes.forEach((attr) => {
      let name;
      let attribute = {};
      Object.keys(attr).forEach((key) => {
        if (key == "key") {
          name = attr[key];
        } else if (key.match(/_value$/)) {
          attribute.value = attr[key];
        } else if (key == "values") {
          attribute.values = [];
          attr[key].forEach((val) => {
            let value = {};
            Object.keys(val).forEach((vkey) => {
              if (vkey.match(/_value$/)) {
                value.value = val[vkey];
              } else {
                value[vkey] = val[vkey];
              }
            });
            attribute.values.push(value);
          });
        } else {
          attribute[key] = attr[key];
        }
      });
      attributes[name] = attribute;
    });
  }
  doc.attributes = attributes;
  return doc;
};
