const { Db } = require("../database/db");

const query = async (query, array) => {
  const [value] = await Db.query(query, array === undefined ? [] : array);
  return value;
};

const queryBulk = async (query, array) => {
  return await Db.format(query, array === undefined ? [] : array);
};

module.exports = {
  query,
  queryBulk,
};
