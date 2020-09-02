import formatJson from "../functions/formatJson";
import client from "../functions/connection";
import checkDocResponse from "../functions/checkDocResponse";

const processDoc = ({ doc }) => {
  let attributes = {};
  console.log(doc);
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
              if (key.match(/_value$/)) {
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

const getRecordsById = async (params) => {
  let ids = params.recordId;
  if (params.result == "taxon") {
    ids = ids.map((id) => (id.match(/^taxon_id-/) ? id : `taxon_id-${id}`));
  }
  const { body } = await client
    .mget({
      index: `${params.result}--ncbi--demo--v0.1`,
      body: { ids },
    })
    .catch((err) => {
      return err.meta;
    });
  let status = checkDocResponse({ body });
  let records = [];
  if (status.hits) {
    body.docs.forEach((doc) => {
      let obj = { id: doc._id, index: doc._index, found: doc.found };
      if (doc.found && doc._source) {
        obj.record = processDoc({ doc: doc._source });
      }
      records.push(obj);
    });
  }
  return { status, records };
};

module.exports = {
  getRecords: async (req, res) => {
    let response = {};
    response = await getRecordsById(req.query);
    return res.status(200).send(formatJson(response, req.query.indent));
  },
};
