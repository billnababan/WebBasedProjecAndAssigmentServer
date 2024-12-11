const jwt = require("jsonwebtoken");

const authenticationToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization token is missing" });
  }

  // Extract token from the 'Authorization' header (expecting 'Bearer <token>')
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Token is missing from the Authorization header" });
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Invalid token:", error.message);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

module.exports = { authenticationToken };
