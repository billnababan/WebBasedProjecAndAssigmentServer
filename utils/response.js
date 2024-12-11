const res200 = (res, data) => {
  return res.status(200).send(data);
};

const res400 = (res, data) => {
  return res.status(400).send(data);
};

module.exports = { res200, res400 };
