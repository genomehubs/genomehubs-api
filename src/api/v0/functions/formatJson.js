const formatJson = (json, indent) => {
  if (indent) {
    return JSON.stringify(json, null, indent) + "\n";
  }
  return json;
};

export default formatJson;
