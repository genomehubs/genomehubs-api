let all_taxa = {
  '3702': {
    name: 'Arabidopsis thaliana',
    properties: {size: 'small', height: 100}
  }
};

const taxaById = (taxid_list) => {
  let taxa = []
  taxid_list.split(',').forEach((name) => {
    if (all_taxa[name]){
      taxa.push(all_taxa[name])
    }
  });
  return taxa;
};

const propertiesById = (taxid_list, propid_list) => {
  let taxa = taxaById(taxid_list)
  return taxa.map(taxon => taxon.properties)
};

const propertySummaryById = (taxid_list, propid_list, type_list) => {
  let properties = propertiesById(taxid_list, propid_list)
  return properties.map(property => taxon.properties)
};

const formatJson = (json, indent) => {
  if (indent){
    return JSON.stringify(json, null, indent)+'\n'
  }
  return json
}


module.exports = {
  getTaxaById: (req, res) => {
    console.log(req)
    return res.status(200).send(
      formatJson(
        taxaById(req.params.taxonId),
        req.query.indent
      )
    )
  },
  getpropertiesById: (req, res) =>
    res.status(200).send(
      formatJson(
        propertiesById(
          req.params.taxonId, req.params.propertyId
        ),
        req.query.indent
      )
    ),
  getPropertySummaryById: (req, res) =>
    res.status(200).send(
      formatJson(
        propertySummaryById(
          req.params.taxonId, req.params.propertyId, req.params.summaryType
        ),
        req.query.indent
      )
  ),
};
