const path = require("path");

// Ensure the path is absolute and normalized
const fileDir = () => {
  // Get the absolute path to the files directory
  return path.resolve(__dirname, "../../files");
};

module.exports = {
  fileDir,
};
