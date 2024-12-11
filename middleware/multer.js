const multer = require("multer");
const { fileDir } = require("../utils/file_handler.cjs");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, fileDir());
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now().toString();
    cb(null, `${uniqueSuffix}${file.originalname}`);
  },
});

module.exports = multer({ storage: storage }).single("photo");
