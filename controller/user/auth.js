const { query } = require("../../utils/query");
// const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

const getUserRole = async (req, res) => {
  try {
    // The user's information should be available in req.user
    // This is typically set by the authenticationToken middleware
    if (!req.user) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Return the user's role
    return res.status(200).json({ role: req.user.role });
  } catch (error) {
    console.error("Error in getUserRole:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

const Login = async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const cekUser = await query(`SELECT uuid, username, password, role, photo, is_deleted FROM users WHERE username = ?`, [username]);

    if (cekUser.length === 0) {
      return res.status(400).json({ error: "Username doesn't exist" });
    }

    const user = cekUser[0];

    if (user.is_deleted) {
      return res.status(400).json({ error: "User has been deleted" });
    }

    // Validate password (uncomment bcrypt validation if used)
    // const isPasswordMatch = await bcrypt.compare(password, user.password);
    // if (!isPasswordMatch) {
    //   return res.status(400).json({ error: "Password is incorrect" });
    // }

    if (password !== user.password) {
      return res.status(400).json({ error: "Password is incorrect" });
    }

    const payload = {
      uuid: user.uuid,
      username: user.username,
      role: user.role,
      photo: user.photo,
    };

    const token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1d" });
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 3600000 * 24, // 1 day
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return res.status(200).json({ success: true, token, role: user.role });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const register = async (req, res) => {
  const { username, password, confPassword, role } = req.body;
  const loggedInUserRole = req.user.role; // Anggap role admin diambil dari token atau sesi

  try {
    // Hanya admin yang dapat melakukan registrasi
    if (loggedInUserRole !== "admin") {
      return res.status(403).json({ error: "Access denied. Only admin can add users." });
    }

    if (!username || !password || !confPassword || !role) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password !== confPassword) {
      return res.status(400).json({ error: "Password doesn't match" });
    }

    if (!["manager", "employee"].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Only 'manager' or 'employee' can be assigned." });
    }

    const isUserExist = await query("SELECT username FROM users WHERE username = ?", [username]);
    if (isUserExist.length > 0) {
      return res.status(400).json({ error: "Username already exists" });
    } else {
      // Default values for non-admin users

      const isDeleted = 0;

      await query(
        `INSERT INTO users (uuid, username, password, photo, role, is_deleted, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?,  ?, ?)`,
        [uuidv4(), username, password, null, role, isDeleted, new Date(), new Date()]
      );

      return res.status(201).json({ message: "User created successfully" });
    }
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const Logout = (req, res) => {
  try {
    // Menghapus cookie token
    res.clearCookie("token", {
      httpOnly: true,

      sameSite: "strict", // Hindari penggunaan lintas situs
    });
    res.status(200).json({ success: true, message: "Logout successful" });
  } catch (error) {
    res.status(500).json({ error: "Failed to logout" });
  }
};

module.exports = {
  getUserRole,
  Login,
  register,
  Logout,
};
