export const checkDocResponse = ({ body }) => {
  let status = { hits: 0, success: true };
  if (body.error) {
    status.success = false;
    status.error = body.error.type;
    return status;
  }
  if (body.timed_out) {
    status.success = false;
    status.error = "Timed out";
    return status;
  }
  status.hits = body.docs.length;
  return status;
};
