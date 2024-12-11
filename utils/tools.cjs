const dayjs = require("dayjs");
const { randomUUID } = require("crypto");
const path = require("path");

const dateValue = () => {
  return dayjs().format("YYYY-MM-DD-HH:mm:ss");
};

const fileDir = () => path.join(__dirname, "../../files");

const uuid = () => randomUUID();

module.exports = { dateValue, fileDir, uuid };
