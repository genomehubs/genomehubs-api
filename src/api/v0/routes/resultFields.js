import { attrTypes } from "../functions/attrTypes";
import { config } from "../functions/config";
import { formatJson } from "../functions/formatJson";

module.exports = {
  getResultFields: async (req, res) => {
    let fields = {};
    let status = {};
    let release = config.release;
    let hub = config.hub;
    let source = config.source;
    try {
      fields = await attrTypes({ ...req.query });
      status = { success: true };
    } catch {
      status = { success: false, error: "Unable to fetch fields" };
    }
    let response = { status, fields, hub, release, source };
    return res.status(200).send(formatJson(response, req.query.indent));
  },
};
