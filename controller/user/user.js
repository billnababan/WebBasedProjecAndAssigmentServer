const { query } = require("../../utils/query");
// const bcrypt = require("bcrypt");

const updatePassword = async (req, res) => {
  const { newPassword, confPassword } = req.body;
  const userUuid = req.params.uuid; // UUID from the URL parameter

  try {
    // Validate the new and confirmed password
    if (!newPassword || !confPassword) {
      return res.status(400).json({ error: "Both new password and confirmation password are required." });
    }

    if (newPassword !== confPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    // Optional: Role-based logic can be added here (if needed)
    // For example: Only admins can update passwords for others (this is optional)
    // const loggedInUserRole = req.user.role;
    // if (loggedInUserRole !== "admin") {
    //   return res.status(403).json({ error: "Only admins can update passwords for other users." });
    // }

    // Hash the new password (if you plan to use bcrypt)
    // const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update the password for the user identified by the UUID in the URL
    await query(`UPDATE users SET password = ?, updated_at = ? WHERE uuid = ?`, [newPassword, new Date(), userUuid]);

    return res.status(200).json({ message: "Password updated successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
};

const DeleteUser = async (req, res) => {
  const { uuid } = req.params; // Mengambil uuid dari parameter

  try {
    if (!uuid) {
      return res.status(400).json({ error: "UUID is required" });
    }

    // Query untuk memeriksa apakah pengguna ada di database
    const cekUser = await query(`SELECT * FROM users WHERE uuid = ?`, [uuid]);

    if (cekUser.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    // Melakukan soft delete dengan mengubah is_deleted menjadi 1
    await query(`UPDATE users SET is_deleted = 1 WHERE uuid = ?`, [uuid]);

    return res.status(200).json({ success: true, message: "User has been deleted" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  updatePassword,
  DeleteUser,
};
